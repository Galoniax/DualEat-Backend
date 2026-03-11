import { prisma } from "../../../core/database/prisma/prisma";
import { OrderStatus } from "@prisma/client";

export class OrderService {
  constructor() {}

  // =========================================================
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
        order_items: {
          include: {
            food: true,
          },
        },
      },
    });
  };


  // =========================================================
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


  // =========================================================
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
}
