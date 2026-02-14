import { Router } from "express";

import { FoodCategoryController } from "../controllers/food-category.controller";
import { FoodCategoryService } from "../services/category.service";

const service = new FoodCategoryService();
const controller = new FoodCategoryController(service);

const router = Router();


// 1. RUTA PARA OBTENER TODAS LAS CATEGORÍAS DE COMIDA DE UN LOCAL
// =========================================
router.get("/local/:localId", controller.handleGetLocalMenuCategories);

// 2. RUTAS PARA CATEGORÍAS DE COMIDA (CRUD)
// =========================================
router.post("/", controller.handleCreateLocalMenuCategory);

// 3. RUTA PARA ELIMINAR UNA CATEGORÍA DE COMIDA
// =========================================
router.delete("/:id", controller.handleDeleteLocalMenuCategory);

// 4. RUTA PARA OBTENER TODAS LAS CATEGORÍAS DE COMIDA
// =========================================
router.get("/categories", controller.handleGetAllFoodCategories);

export default router;
