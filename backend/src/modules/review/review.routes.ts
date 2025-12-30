import { Router } from "express";

import { ReviewService } from "./review.service";
import { ReviewController } from "./review.controller";

const router = Router();

const service = new ReviewService();
const controller = new ReviewController(service);


// 1. Obtener reseñas por ID de local
// =========================================================
router.get("/locals/:id/reviews", controller.getReviews);

// 2. Crear reseña para ID de local
// =========================================================
router.post("/locals/:id/reviews", controller.createReview);

export default router;
