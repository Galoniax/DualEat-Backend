import { Router } from "express";
import { CommunityTagController } from "../controllers/community-tag.controller";

import { isAuthenticated } from "../../../core/middlewares/isAuthenticated";
import { limiter } from "../../../core/middlewares/rateLimiter";
import { CommunityTagService } from "../services/community-tag.service";
import { TagCategoryService } from "../services/tag-category.service";

const router = Router();

const service = new CommunityTagService();
const tService = new TagCategoryService();

const controller = new CommunityTagController(service, tService);

// 1. Obtener todas las categorias de etiquetas
// =========================================================
router.get("/categories", controller.getAllCategories.bind(controller));

// 2. Obtener todas las etiquetas
// =========================================================
router.get("/tags", controller.getAllTags.bind(controller));

// 3. Obtener todas las etiquetas por categorias (por id de la categoria)
// =========================================================
router.get("/tags/category/:category_id", controller.getByCategoryId.bind(controller));

// 4. Crear una nueva etiqueta
// =========================================================
router.post(
  "/tag",
  limiter(false),
  isAuthenticated,
  controller.create.bind(controller),
);

// 5. Actualizar una etiqueta
// =========================================================
router.put(
  "/tag/update",
  limiter(false),
  isAuthenticated,
  controller.update.bind(controller),
);

// 6. Eliminar una etiqueta
// =========================================================
router.delete(
  "/tag/delete",
  limiter(false),
  isAuthenticated,
  controller.delete.bind(controller),
);

export default router;
