import { prisma } from "../../core/database/prisma/prisma";
import { LocalNotificationService } from "../notification/local/local-notification.service";

export class ReviewService {
  /** GET REVIEWS BY LOCAL ID */
  async getReviews(localId: string) {
    return await prisma.localReview.findMany({
      where: { local_id: localId },
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

  /** CREATE REVIEW FOR LOCAL ID */
  async createReview(
    localId: string,
    userId: string,
    rating: number,
    comment?: string
  ) {
    const review = await prisma.localReview.create({
      data: {
        local_id: localId,
        user_id: userId,
        rating,
        comment,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Envía notificación WebSocket al dueño del local (dispara y olvida)
    const localNotificationService = new LocalNotificationService();
    localNotificationService.sendReviewNotification(
      localId,
      rating,
      review.user.name
    ).catch(e => console.error("Error disparando notificacion:", e));

    return review;
  }
}
