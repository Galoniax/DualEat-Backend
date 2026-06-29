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
  // =========================================================
  async prePurchase(
    local_id: string,
    user: User,
    items: {
      food_id: string;
      quantity: number;
      unit_price: number;
      name: string;
    }[],
    platform?: "mobile" | "web",
    backendBaseUrl?: string,
  ) {
    const service = new PaymentService();
    const accessToken = await service.getRefreshToken(local_id);

    /*if (!accessToken && process.env.NODE_ENV === "production") {
      const e = new Error(
        "El local no tiene configuradas sus credenciales de Mercado Pago para recibir cobros.",
      ) as any;
      e.status = 400;
      throw e;
    }*/

    console.log("accessToken", accessToken);

    // 2. Crear la orden PENDING en la base de datos
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

      const result = await tx.order.create({
        data: {
          user_id: user.id,
          local_id,
          status: OrderStatus.IN_PROGRESS,
          total: total,
          payment_method: "MERCADOPAGO",
          order_items: {
            create: orderItemsData,
          },
        },
        include: {
          order_items: true,
        },
      });

      return result;
    });

    if (!order) {
      const e = new Error("Error en la creación de la orden.") as any;
      e.status = 400;
      throw e;
    }

    // Obtener el nombre del local para la preferencia
    const local = await prisma.local.findUnique({
      where: { id: local_id },
      select: { name: true },
    });
    const localName = local?.name || "Local";

    // Calcular el 5% de comisión
    const marketplaceFee = Number((order.total * 0.05).toFixed(2));

    // Generar una descripción con el desglose de los productos para mostrar al comprador
    const itemDescription = items
      .map((i) => `${i.name} (x${i.quantity})`)
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

    let success = `${process.env.CLIENT_URL}/order/success`;
    let failure = `${process.env.CLIENT_URL}/order/failure`;
    let pending = `${process.env.CLIENT_URL}/order/pending`;

    if (platform === "mobile" && backendBaseUrl) {
      // Si el host es una IP local o localhost, usamos la URL pública de ngrok en HTTPS
      // para que Mercado Pago acepte el auto_return sin dar error
      const baseRedirect =
        backendBaseUrl.includes("192.168") ||
        backendBaseUrl.includes("localhost") ||
        backendBaseUrl.includes("127.0.0.1")
          ? "https://f4d8-190-190-126-222.ngrok-free.app"
          : backendBaseUrl;

      success = `${baseRedirect}/api/payment/callback?status=success&type=PRE_ORDER&id=${order.id}`;
      failure = `${baseRedirect}/api/payment/callback?status=failure&type=PRE_ORDER&id=${order.id}`;
      pending = `${baseRedirect}/api/payment/callback?status=pending&type=PRE_ORDER&id=${order.id}`;
    }

    const request: PreferenceRequest = {
      items: mpItems,
      external_reference: `DUALEAT-ORDER-${order.id}`,
      back_urls: {
        success,
        failure,
        pending,
      },
      auto_return: "approved",
      binary_mode: true,
      statement_descriptor: "DUALEAT",
      //marketplace_fee: marketplaceFee,
      payer: {
        email: user.email,
        name: user.name,
      },
      metadata: {
        order_id: order.id,
        local_id: local_id,
        user_id: user.id,
      },
    };

    try {
      const response = await requestClient(request, accessToken);

      return {
        order,
        checkoutUrl: response,
      };
    } catch (e: any) {
      throw new Error(`Error en la API de Mercado Pago: ${e}`);
    }
  }
}
