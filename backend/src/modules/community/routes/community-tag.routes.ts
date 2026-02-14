import { Router } from "express";
import { CommunityTagController } from "../controllers/community-tag.controller";

import { isAuthenticated } from "../../../core/middlewares/isAuthenticated";
import { generalLimiter } from "../../../core/middlewares/rateLimiter";
import { CommunityTagService } from "../services/community-tag.service";
import { TagCategoryService } from "../services/tag-category.service";

const router = Router();

const service = new CommunityTagService();
const tagCatService = new TagCategoryService();

const controller = new CommunityTagController(service, tagCatService);


// 0. Obtener todas las categorias de etiquetas
// ========================================================= 
router.get("/categories", controller.getAllCategories.bind(controller));

// 1. Obtener todas las etiquetas
// ========================================================= 
router.get("/", controller.getAll.bind(controller));

// 2. Obtener todas las etiquetas por categorias (por id de la categoria)
// =========================================================
router.get("/tags/by-category", controller.getByCategoryId.bind(controller));

// 3. Crear una nueva etiqueta
// =========================================================
router.post("/tag", generalLimiter, isAuthenticated, controller.create.bind(controller));

// 4. Actualizar una etiqueta
// =========================================================
router.put("/tag/update", generalLimiter, isAuthenticated, controller.update.bind(controller));

// 5. Eliminar una etiqueta
// =========================================================
router.delete("/tag/update", generalLimiter, isAuthenticated, controller.delete.bind(controller));

export default router;
