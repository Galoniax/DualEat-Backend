import { Router } from "express";

import { FoodCategoryController } from "../controllers/food-category.controller";
import { FoodCategoryService } from "../services/category.service";

const service = new FoodCategoryService();
const controller = new FoodCategoryController(service);

const router = Router();

// Ruta GET para obtener las categorías de un local
router.get("/local/:localId", controller.handleGetLocalMenuCategories);

// Ruta POST para crear una categoría de menú para un local
router.post("/", controller.handleCreateLocalMenuCategory);

// Ruta DELETE para eliminar una categoría de menú de un local
router.delete("/:id", controller.handleDeleteLocalMenuCategory);

export default router;
