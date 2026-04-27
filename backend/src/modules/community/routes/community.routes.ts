import { Router } from "express";
import { CommunityController } from "../controllers/community.controller";

import { isAuthenticated } from "../../../core/middlewares/isAuthenticated";
import { limiter } from "../../../core/middlewares/rateLimiter";

import multer from "multer";
import { CommunityService } from "../services/community.service";
import { CommunityTagService } from "../services/community-tag.service";

const upload = multer({
  limits: { fileSize: 1024 * 1024 * 10 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de archivo no permitido"));
    }
  },
});

const router = Router();

const service = new CommunityService();
const tService = new CommunityTagService();

const controller = new CommunityController(service, tService);

// 1. Obtener todas las comunidades por name
// =========================================================
router.get("/name", controller.getByName.bind(controller));

// 2. Obtener las comunidades de un usuario
// =========================================================
router.get(
  "/user",
  isAuthenticated,
  controller.getUserCommunities.bind(controller),
);

// 3. Obtener todas las comunidades por categoria (id de la categoria)
// =========================================================
router.get(
  "/category/:category_id",
  controller.getByCategorySkeleton.bind(controller),
);

// 4. Obtener todas las comunidades por tag (id de la etiqueta)
// =========================================================
router.get("/tag/:tag_id", controller.getByTag.bind(controller));

// 5. Obtener comunidad por id
// =========================================================
router.get(
  "/:community_slug",
  isAuthenticated,
  controller.getBySlug.bind(controller),
);

// 6. Crear comunidad
// =========================================================
router.post(
  "/create",
  limiter(false),
  isAuthenticated,
  upload.none(),
  controller.create.bind(controller),
);

// 7. Unirse o salir de comunidad
// =========================================================
router.post(
  "/join-leave",
  limiter(false),
  isAuthenticated,
  upload.none(),
  controller.joinLeave.bind(controller),
);

// 8. Subir archivos de una comunidad
// =========================================================
router.post(
  "/upload",
  limiter(false),
  isAuthenticated,
  upload.fields([
    { name: "banner_url", maxCount: 1 },
    { name: "image_url", maxCount: 1 },
  ]),
  controller.upload.bind(controller),
);

export default router;
