import { prisma } from "@/core/database/prisma/prisma";
import {
  requestClient,
  PaymentService,
} from "@/modules/payment/services/payment.service";
import { OrderStatus, User } from "@prisma/client";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { Items } from "mercadopago/dist/clients/commonTypes";
import { PreferenceRequest } from "mercadopago/dist/clients/preference/commonTypes";

const config = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || "",
});

const preferenceClient = new Preference(config);

export class OrderService {
  constructor() {}

  // OBTENER ORDENES DE UN LOCAL
  // =========================================================
  async getOrders(
    localId: string,
    status?: string,
    from?: string,
    to?: string,
  ) {
    // Validar y castear el status a enum
    let statusEnum: OrderStatus | undefined;
    if (status && Object.values(OrderStatus).includes(status as OrderStatus)) {
      statusEnum = status as OrderStatus;
    }

    return await prisma.order.findMany({
      where: {
        local_id: localId,
        status: {
          not: OrderStatus.IN_PROGRESS,
          in: statusEnum ? [statusEnum] : undefined,
        },
        created_at: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      orderBy: {
        created_at: "desc",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
          },
        },
        order_items: {
          include: {
            food: true,
          },
        },
      },
    });
  }

  // OBTENER ORDENES DE UN USUARIO
  // =========================================================
  async getUserOrders(u: string, page: number, type?: OrderStatus | "REVIEW") {
    try {
      const size = 10;
      const currentPage = Math.max(1, page);
      const skip = (currentPage - 1) * size;

      const orders = await prisma.order.findMany({
        where: {
          user_id: u,
          status: {
            not: OrderStatus.IN_PROGRESS,
            ...(type !== "REVIEW" && {
              equals: type as OrderStatus,
            }),
          },

          ...(type === "REVIEW" && {
            review: { is: null },
          }),
        },
        orderBy: {
          created_at: "desc",
        },
        skip,
        take: size + 1,
        include: {
          local: {
            select: {
              id: true,
              name: true,
              slug: true,
              image_url: true,
              address: true,
            },
          },
          review: {
            select: {
              rating: true,
            },
          },
          _count: {
            select: {
              order_items: true,
            },
          },
        },
      });

      const hasMore = orders.length > size;
      if (hasMore) orders.pop();

      return {
        data: orders,
        pagination: {
          page: currentPage,
          hasMore,
        },
      };
    } catch (e: any) {
      throw new Error("No se pudieron obtener las órdenes");
    }
  }

  // OBTENER ORDEN POR ID
  // =========================================================
  async getById(id: string) {
    try {
      const order = await prisma.order.findUnique({
        where: {
          id,
          status: {
            not: OrderStatus.IN_PROGRESS,
          },
        },
        include: {
          order_items: {
            include: {
              food: {
                select: {
                  id: true,
                  name: true,
                  image_url: true,
                  description: true,
                },
              },
            },
          },
          local: {
            select: {
              id: true,
              name: true,
              slug: true,
              image_url: true,
              address: true,
            },
          },
          review: true,
        },
      });

      if (!order) throw new Error("Orden no encontrada");

      return order;
    } catch (e) {
      throw e;
    }
  }

  // CREAR ORDEN MANUAL (STAFF)
  // =========================================================
  async createManualOrder(
    localId: string,
    userId: string,
    items: { food_id: string; quantity: number }[],
    notes?: string,
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        let total = 0;
        const orderItemsData = [];

        for (const item of items) {
          const food = await tx.food.findUnique({
            where: { id: item.food_id },
          });
          if (!food || food.local_id !== localId) {
            throw new Error(
              `Producto no encontrado o no pertenece a este local: ${item.food_id}`,
            );
          }

          // Todo: Verificar si hay promociones activas si fuera necesario,
          // por ahora usamos el precio base
          const subtotal = Number(food.price) * item.quantity;
          total += subtotal;

          orderItemsData.push({
            food_id: food.id,
            quantity: item.quantity,
            unit_price: food.price,
            subtotal: subtotal,
          });
        }

        const order = await tx.order.create({
          data: {
            user_id: userId, // ID del empleado
            local_id: localId,
            status: "PENDING",
            total: total,
            payment_method: "MANUAL_STAFF",
            notes: notes,
            order_items: {
              create: orderItemsData,
            },
          },
          include: {
            order_items: true,
          },
        });

        return order;
      });
    } catch (error) {
      console.error("Error creating manual order:", error);
      throw error;
    }
  }

  // ACTUALIZAR ESTADO DE ORDEN
  // =========================================================
  async updateOrderStatus(
    orderId: string,
    localId: string,
    status: OrderStatus,
  ) {
    try {
      const order = await prisma.order.findUnique({ where: { id: orderId } });

      if (!order) throw new Error("Orden no encontrada.");
      if (order.local_id !== localId)
        throw new Error("La orden no pertenece a este local.");

      // No permitir cambios en órdenes ya completadas o canceladas
      if (order.status === "COMPLETED" || order.status === "CANCELLED") {
        throw new Error(
          `No se puede cambiar el estado de una orden ${order.status}.`,
        );
      }

      return await prisma.order.update({
        where: { id: orderId },
        data: { status },
        include: {
          user: {
            select: { id: true, name: true, avatar_url: true },
          },
          order_items: {
            include: { food: true },
          },
        },
      });
    } catch (error) {
      console.error("Error updating order status:", error);
      throw error;
    }
  }

  // ACTUALIZAR ITEMS DE ORDEN (EDITAR)
  // =========================================================
  async updateOrderItems(
    orderId: string,
    localId: string,
    items: { food_id: string; quantity: number }[],
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id: orderId } });

        if (!order) throw new Error("Orden no encontrada.");
        if (order.local_id !== localId)
          throw new Error("La orden no pertenece a este local.");
        if (order.status === "COMPLETED" || order.status === "CANCELLED") {
          throw new Error(`No se puede editar una orden ${order.status}.`);
        }

        // Eliminar items anteriores
        await tx.orderItem.deleteMany({ where: { order_id: orderId } });

        // Crear nuevos items
        let total = 0;
        const orderItemsData = [];

        for (const item of items) {
          const food = await tx.food.findUnique({
            where: { id: item.food_id },
          });
          if (!food || food.local_id !== localId) {
            throw new Error(
              `Producto no encontrado o no pertenece a este local: ${item.food_id}`,
            );
          }

          const subtotal = Number(food.price) * item.quantity;
          total += subtotal;

          orderItemsData.push({
            food_id: food.id,
            quantity: item.quantity,
            unit_price: food.price,
            subtotal: subtotal,
          });
        }

        const updated = await tx.order.update({
          where: { id: orderId },
          data: {
            total,
            order_items: {
              create: orderItemsData,
            },
          },
          include: {
            user: {
              select: { id: true, name: true, avatar_url: true },
            },
            order_items: {
              include: { food: true },
            },
          },
        });

        return updated;
      });
    } catch (error) {
      console.error("Error updating order items:", error);
      throw error;
    }
  }

  // CREAR ORDEN Y PREFERENCIA
  // =========================================================  // HELPER PARA GENERAR LA PREFERENCIA DE MERCADO PAGO
  private async generatePreference(
    order: any,
    url: string,
    type: "PRE_ORDER" | "ORDER",
  ) {
    const service = new PaymentService();
    const accessToken = await service.getRefreshToken(order.local_id);

    if (!accessToken && process.env.NODE_ENV === "production") {
      const e = new Error(
        "El local no tiene configuradas sus credenciales de Mercado Pago para recibir cobros.",
      ) as any;
      e.status = 400;
      throw e;
    }

    const localName = order.local?.name || "Local";

    // Generar la descripción de los items
    const itemDescription = order.order_items
      .map((item: any) => `${item.food.name} (x${item.quantity})`)
      .join(", ");

    const mpItems: Items[] = [
      {
        id: `ORDER-${order.id}`,
        title: `Pedido en ${localName}`,
        description:
          itemDescription.length > 250
            ? itemDescription.slice(0, 247) + "..."
            : itemDescription,
        quantity: 1,
        unit_price: order.total,
        currency_id: "ARS",
      },
    ];

    const request: PreferenceRequest = {
      items: mpItems,
      external_reference: `DUALEAT-ORDER-${order.id}`,
      back_urls: {
        success: `${url}?status=success&type=${type}&id=${order.id}`,
        failure: `${url}?status=failure&type=${type}&id=${order.id}`,
        pending: `${url}?status=pending&type=${type}&id=${order.id}`,
      },
      auto_return: "approved",
      binary_mode: true,
      statement_descriptor: "DUALEAT",
      payer: {
        email: order.user.email,
        name: order.user.name,
      },
      metadata: {
        order_id: order.id,
        local_id: order.local_id,
        user_id: order.user_id,
      },
    };

    console.log(`[MP PREFERENCE REQUEST - ${type}]:`, request);

    return await requestClient(request, accessToken);
  }

  // CREAR ORDEN Y PREFERENCIA (PRECOMPRA DIRECTA DESDE CARRITO)
  // =========================================================
  async prePurchase(
    local_id: string,
    user_id: string,
    items: {
      food_id: string;
      quantity: number;
      unit_price: number;
      name: string;
    }[],
    url: string,
  ) {
    // 1. Crear la orden PENDING en la base de datos
    const order = await prisma.$transaction(async (tx) => {
      let total = 0;
      const orderItemsData = [];

      for (const item of items) {
        const subtotal = item.unit_price * item.quantity;
        total += subtotal;

        orderItemsData.push({
          food_id: item.food_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: subtotal,
        });
      }

      return await tx.order.create({
        data: {
          user_id: user_id,
          local_id,
          status: OrderStatus.IN_PROGRESS,
          total: total,
          payment_method: "MERCADOPAGO",
          order_items: {
            create: orderItemsData,
          },
        },
        include: {
          order_items: {
            include: {
              food: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          local: {
            select: {
              name: true,
            },
          },
        },
      });
    });

    if (!order) {
      const e = new Error("Error en la creación de la orden.") as any;
      e.status = 400;
      throw e;
    }

    try {
      const checkoutUrl = await this.generatePreference(
        order,
        url,
        "PRE_ORDER",
      );

      return {
        order,
        checkoutUrl,
      };
    } catch (e: any) {
      throw new Error(`Error en la API de Mercado Pago: ${e.message || e}`);
    }
  }

  // PAGAR ORDEN EXISTENTE (DESDE CÓDIGO QR / MESA)
  // =========================================================
  async purchase(u: string, oi: string, url: string) {
    const order = await prisma.order.findUnique({
      where: { id: oi },
      include: {
        order_items: {
          include: {
            food: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        local: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!order) {
      const e = new Error("La orden no existe o no ha sido completada.") as any;
      e.status = 404;
      throw e;
    }

    if (order.user_id !== u) {
      const e = new Error(
        "No tienes permiso para actualizar esta orden.",
      ) as any;
      e.status = 403;
      throw e;
    }

    if (
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.PAID
    ) {
      const e = new Error("La orden ya ha sido pagada.") as any;
      e.status = 409;
      throw e;
    }

    try {
      const checkoutUrl = await this.generatePreference(order, url, "ORDER");

      return {
        checkoutUrl,
      };
    } catch (e: any) {
      throw e;
    }
  }
}
