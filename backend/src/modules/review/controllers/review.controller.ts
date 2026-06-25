import { Request, Response } from "express";
import { ReviewService } from "@/modules/review/services/review.service";
import { ReviewDTO } from "../types/review.dto";

export class ReviewController {
  constructor(private service: ReviewService) {}

  // OBTENER RESEÑAS DE UN LOCAL
  // =========================================================
  getByLocalId = async (req: Request, res: Response) => {
    try {
      const local_id = req.params.id;

      if (typeof local_id !== "string" || !local_id) {
        return res.status(400).json({ error: "El ID del local no es válido." });
      }

      const reviews = await this.service.getByLocalId(local_id);

      return res.json(reviews);
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error interno del servidor",
      });
    }
  };

  // CREAR RESEÑA
  // =========================================================
  create = async (req: Request, res: Response) => {
    try {
      const user_id = (req as any).user?.id;
      const { review } = req.body as { review: ReviewDTO };

      const result = await this.service.create(user_id, review);

      return res.status(201).json({
        success: true,
        message: "Reseña creada con éxito",
        data: result,
      });
    } catch (e: any) {
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Error interno del servidor",
      });
    }
  };

  // ACTUALIZAR RESEÑA
  // =========================================================
  update = async (req: Request, res: Response) => {
    try {
      const review_id = req.params.id as string;
      const user_id = (req as any).user?.id;
      const { review } = req.body as { review: ReviewDTO };

      if (typeof review_id !== "string" || !review_id) {
        return res
          .status(400)
          .json({ error: "El ID de la reseña no es válido." });
      }

      const result = await this.service.update(review_id, user_id, review);

      return res.status(201).json({
        success: true,
        message: "Reseña creada con éxito",
        data: result,
      });
    } catch (e: any) {
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Error interno del servidor",
      });
    }
  };
}
