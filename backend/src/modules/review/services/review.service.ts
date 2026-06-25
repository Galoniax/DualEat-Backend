import { prisma } from "@/core/database/prisma/prisma";
import { LocalNotificationService } from "../../notification/local/local-notification.service";
import { ReviewDTO } from "../types/review.dto";
import { OrderStatus, Prisma } from "@prisma/client";

export class ReviewService {
  // OBTENER RESEÑAS DE UN LOCAL
  // =========================================================
  async getByLocalId(local_id: string) {
    return await prisma.localReview.findMany({
      where: { local_id: local_id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
  }

  // CREAR RESEÑA
  // =========================================================
  async create(user_id: string, review: ReviewDTO) {
    const service = new LocalNotificationService();

    let e: any;

    const order = await prisma.order.findUnique({
      where: { id: review.order_id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        review: true,
      },
    });

    if (!order) {
      e = new Error("La orden no existe.");
      e.status = 404;
      throw e;
    }

    if (order.user_id !== user_id) {
      e = new Error("No tienes permiso para crear una reseña para esta orden.");
      e.status = 403;
      throw e;
    }

    if (order.review) {
      e = new Error("Esta orden ya ha sido calificada.");
      e.status = 409;
      throw e;
    }

    if (order.status !== OrderStatus.COMPLETED) {
      e = new Error(
        "Solo puedes calificar órdenes que hayan sido completadas.",
      );
      e.status = 403;
      throw e;
    }

    try {
      const result = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const localReview = await tx.localReview.create({
            data: {
              local_id: order.local_id,
              user_id: user_id,
              rating: review.rating,
              comment: review.comment,
              order_id: review.order_id,
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          });

          if (review.votes) {
            const upIds = review.votes
              .filter((v) => v.type === "UP")
              .map((v) => v.id);
            const downIds = review.votes
              .filter((v) => v.type === "DOWN")
              .map((v) => v.id);

            if (upIds.length > 0) {
              await tx.food.updateMany({
                where: {
                  id: { in: upIds },
                },
                data: {
                  votes_up: { increment: 1 },
                },
              });
            }

            if (downIds.length > 0) {
              await tx.food.updateMany({
                where: {
                  id: { in: downIds },
                },
                data: {
                  votes_down: { increment: 1 },
                },
              });
            }
          }

          const aggregations = await tx.localReview.aggregate({
            where: { local_id: order.local_id },
            _avg: { rating: true },
          });

          const averageRating = aggregations._avg.rating || review.rating;

          await tx.local.update({
            where: { id: order.local_id },
            data: { average_rating: averageRating },
          });

          return localReview;
        },
      );

      if (result) {
        service
          .sendReviewNotification(
            order.local_id,
            review.rating,
            result.user.name,
          )
          .catch((e: any) => {
            e = new Error(
              e.message || "Error al enviar la notificación de la reseña",
            );
            e.status = 500;
            throw e;
          });
      }

      return result;
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2002") {
          const target = e.meta?.target as string[];

          if (target.includes("order_id")) {
            throw new Error("Ya existe una reseña para esta orden.");
          }
        }
      }
      throw e;
    }
  }

  // ACTUALIZAR RESEÑA
  // =========================================================
  async update(review_id: string, user_id: string, review: ReviewDTO) {
    let e: any;

    const exists = await prisma.localReview.findUnique({
      where: { id: review_id },
      select: {
        user_id: true,
        local_id: true,
      },
    });

    if (!exists) {
      e = new Error("La reseña no existe.");
      e.status = 404;
      throw e;
    }

    if (exists.user_id !== user_id) {
      e = new Error("No tienes permiso para eliminar esta reseña.");
      e.status = 403;
      throw e;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.localReview.update({
          where: { id: review_id },
          data: {
            rating: review.rating,
            comment: review.comment,
          },
        });

        const aggregations = await tx.localReview.aggregate({
          where: { local_id: exists.local_id },
          _avg: { rating: true },
        });

        const averageRating = aggregations._avg.rating || review.rating;

        await tx.local.update({
          where: { id: exists.local_id },
          data: { average_rating: averageRating },
        });
      });

      return result;
    } catch (e: any) {
      throw e;
    }
  }
}
