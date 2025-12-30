import { Router } from "express";
import { TagCategoryController } from "../controllers/tag-category.controller";
import { TagCategoryService } from "../services/tag-category.service";

const router = Router();

const service = new TagCategoryService();
const controller = new TagCategoryController(service);

// 1. Obtener todas las categorias de tags
// =========================================================
router.get("/", controller.getAll.bind(controller));

export default router;