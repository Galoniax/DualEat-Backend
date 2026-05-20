import { Router } from "express";

import { isAuthenticated } from "@/core/middlewares/isAuthenticated";
import { limiter } from "@/core/middlewares/rateLimiter";
import { SearchService } from "../services/search.service";
import { SearchController } from "../controllers/search.controller";

const router = Router();

const service = new SearchService();
const controller = new SearchController(service);

// 1. Obtener resultados globales de una búsqueda
// =========================================================
router.get(
  "/global",
  limiter(false),
  isAuthenticated,
  controller.getGlobal.bind(controller),
);

export default router;