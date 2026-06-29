import { Router } from "express";
import multer from "multer";

import { PostController } from "../controllers/post.controller";
import { PostService } from "../services/post.service";

import { isAuthenticated } from "@/core/middlewares/isAuthenticated";
import { limiter } from "@/core/middlewares/rateLimiter";

import { CommentService } from "../services/comment.service";
import { CommentController } from "../controllers/comment.controller";
import { validateBody } from "@/core/middlewares/validation";
import { createPostSchema } from "../types/post.schema";
import { createCommentSchema, updateCommentSchema } from "../types/comment.schema";
import { requireSubscription } from "@/core/middlewares/requireSubscription";

const upload = multer({
  limits: { fileSize: 1024 * 1024 * 20 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de archivo no permitido"));
    }
  },
});

const router = Router();

const service = new PostService();
const controller = new PostController(service);

const cService = new CommentService();
const cController = new CommentController(cService);

// 1. Crear post (opcional receta)
// =========================================================
router.post(
  "/create",
  limiter(false),
  isAuthenticated,
  validateBody(createPostSchema),
  controller.create.bind(controller),
);

// 2. Subir archivos de un post & receta
// =========================================================
router.post(
  "/upload",
  limiter(false),
  isAuthenticated,
  upload.fields([
    { name: "post_images", maxCount: 10 },
    { name: "main_image", maxCount: 1 },
  ]),
  controller.upload.bind(controller),
);

// 3. Obtener posts de una comunidad
// =========================================================
router.get(
  "/:community_id/posts",
  isAuthenticated,
  controller.getCommunityPosts.bind(controller),
);

router.patch("/:post_id", isAuthenticated, controller.delete.bind(controller));

// 4. Obtener todos los posts
// =========================================================
router.get("/", isAuthenticated, controller.getAll.bind(controller));

// 6. Obtener post por id
// =========================================================
router.get("/:id", isAuthenticated, controller.getById.bind(controller));

// COMENTARIOS
// =========================================================

// 7. Obtener comentarios de un post
// =========================================================
router.get(
  "/comments/:post_id",
  isAuthenticated,
  cController.getComments.bind(cController),
);

// 8. Obtener respuestas de un comentario
// =========================================================
router.get(
  "/replies/:comment_id",
  isAuthenticated,
  cController.getReplies.bind(cController),
);

// 7. Crear comentario para un post
// =========================================================
router.post(
  "/comment",
  limiter(false),
  isAuthenticated,
  validateBody(createCommentSchema),
  cController.create.bind(cController),
);

router.patch(
  "/comment/:comment_id",
  limiter(false),
  isAuthenticated,
  requireSubscription,
  validateBody(updateCommentSchema),
  cController.update.bind(cController),
);

// 8. Eliminar comentario
// =========================================================
router.delete(
  "/comment/:comment_id",
  limiter(false),
  isAuthenticated,
  cController.delete.bind(cController),
);

export default router;
