import { prisma } from "@/core/database/prisma/prisma";
import { OrderStatus } from "@prisma/client";

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
        status: statusEnum,
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
  };


  // OBTENER ORDENES DE UN USUARIO
  // =========================================================
  async getUserOrders(u: string, page: number) {
    try {
      const size = 10;
      const currentPage = Math.max(1, page);
      const skip = (currentPage - 1) * size;

      const orders = await prisma.order.findMany({
        where: {
          user_id: u,
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
        }
      };
    } catch (e) {
      return null;
    }
  }

  // OBTENER ORDEN POR ID
  // =========================================================
  async getOrderById(id: string) {
    try {
      const order = await prisma.order.findUnique({
        where: {
          id,
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
          review: {
            select: {
              rating: true,
            },
          },
        },
      });

      if (!order) return null;

      return order;

    } catch (e) {
      return null;
    }
  }

  // =========================================================
  // CREAR ORDEN MANUAL (STAFF)
  // =========================================================
  async createManualOrder(localId: string, userId: string, items: { food_id: string, quantity: number }[], notes?: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        let total = 0;
        const orderItemsData = [];

        for (const item of items) {
          const food = await tx.food.findUnique({ where: { id: item.food_id } });
          if (!food || food.local_id !== localId) {
            throw new Error(`Producto no encontrado o no pertenece a este local: ${item.food_id}`);
          }

          // Todo: Verificar si hay promociones activas si fuera necesario, 
          // por ahora usamos el precio base
          const subtotal = Number(food.price) * item.quantity;
          total += subtotal;

          orderItemsData.push({
            food_id: food.id,
            quantity: item.quantity,
            unit_price: food.price,
            subtotal: subtotal
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
              create: orderItemsData
            }
          },
          include: {
            order_items: true
          }
        });

        return order;
      });
    } catch (error) {
      console.error("Error creating manual order:", error);
      throw error;
    }
  }

  // =========================================================
  // ACTUALIZAR ESTADO DE ORDEN
  // =========================================================
  async updateOrderStatus(orderId: string, localId: string, status: OrderStatus) {
    try {
      const order = await prisma.order.findUnique({ where: { id: orderId } });

      if (!order) throw new Error("Orden no encontrada.");
      if (order.local_id !== localId) throw new Error("La orden no pertenece a este local.");

      // No permitir cambios en órdenes ya completadas o canceladas
      if (order.status === "COMPLETED" || order.status === "CANCELLED") {
        throw new Error(`No se puede cambiar el estado de una orden ${order.status}.`);
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

  // =========================================================
  // ACTUALIZAR ITEMS DE ORDEN (EDITAR)
  // =========================================================
  async updateOrderItems(orderId: string, localId: string, items: { food_id: string; quantity: number }[]) {
    try {
      return await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id: orderId } });

        if (!order) throw new Error("Orden no encontrada.");
        if (order.local_id !== localId) throw new Error("La orden no pertenece a este local.");
        if (order.status === "COMPLETED" || order.status === "CANCELLED") {
          throw new Error(`No se puede editar una orden ${order.status}.`);
        }

        // Eliminar items anteriores
        await tx.orderItem.deleteMany({ where: { order_id: orderId } });

        // Crear nuevos items
        let total = 0;
        const orderItemsData = [];

        for (const item of items) {
          const food = await tx.food.findUnique({ where: { id: item.food_id } });
          if (!food || food.local_id !== localId) {
            throw new Error(`Producto no encontrado o no pertenece a este local: ${item.food_id}`);
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
}
