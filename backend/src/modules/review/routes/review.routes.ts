import { Router } from "express";
import { ReviewService } from "../services/review.service";
import { ReviewController } from "../controllers/review.controller";
import { isAuthenticated } from "@/core/middlewares/isAuthenticated";
import { limiter } from "@/core/middlewares/rateLimiter";
import { validateBody } from "@/core/middlewares/validation";
import { createReviewSchema, updateReviewSchema } from "../types/review.schema";

const router = Router();

const service = new ReviewService();
const controller = new ReviewController(service);

// 1. Obtener reseñas por ID de local
// =========================================================
router.get("/local/:id", controller.getByLocalId.bind(controller));

// 2. Crear reseña para ID de local
// =========================================================
router.post(
  "/create",
  limiter(false),
  isAuthenticated,
  validateBody(createReviewSchema),
  controller.create.bind(controller),
);

// 3. Actualizar reseña
// =========================================================
router.put(
  "/:id",
  limiter(false),
  isAuthenticated,
  validateBody(updateReviewSchema),
  controller.update.bind(controller),
);

export default router;
