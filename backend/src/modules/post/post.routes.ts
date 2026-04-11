import { Router } from "express";

import { PostController } from "./post.controller";

import { isAuthenticated } from "../../core/middlewares/isAuthenticated";
import { limiter } from "../../core/middlewares/rateLimiter";

import multer from "multer";
import { PostService } from "./post.service";

const upload = multer();

const router = Router();

const service = new PostService();

const controller = new PostController(service);

// 1. Crear post (opcional receta)
// =========================================================
router.post(
  "/create",
  limiter(false),
  isAuthenticated,
  upload.any(),
  controller.create.bind(controller)
);

// 2. Obtener todos los posts
// =========================================================
router.get("/", isAuthenticated, controller.getAll.bind(controller));

// 3. Obtener post por id
// =========================================================
router.get("/:id", isAuthenticated, controller.getById.bind(controller));

// 4. Crear comentario para un post
// =========================================================
router.post(
  "/comment",
  limiter(false),
  isAuthenticated,
  controller.createComment.bind(controller)
);

router.post("/test", upload.any(), controller.create.bind(controller));

export default router;
