import { prisma } from "../../core/database/prisma/prisma";

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
    return await prisma.localReview.create({
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
  }
}
