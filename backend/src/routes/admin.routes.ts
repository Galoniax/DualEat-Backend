import { Router } from "express";
import { handleCreateBusinessUserAndLocal } from "../controllers/admin.controller";
import {
 FoodCategoryController
} from "../modules/menu/controllers/food-category.controller";
import {
  handleGetLocals,
  handleGetLocalById,
  handleUpdateLocal,
  handleDeleteLocal,
} from "../controllers/local.controller";

import { FoodCategoryService } from "../modules/menu/services/category.service";

const router = Router();

const service = new FoodCategoryService();
const controller = new FoodCategoryController(service);



// Rutas para Negocios
router.post("/business", handleCreateBusinessUserAndLocal);

// Rutas para Categorías de Comida
router.get("/food-categories", controller.handleGetAllFoodCategories);
router.post("/food-categories", controller.handleCreateFoodCategory);
router.put("/food-categories/:id", controller.handleUpdateFoodCategory);
router.delete("/food-categories/:id", controller.handleDeleteFoodCategory);

// Rutas para Locales
router.get("/locals", handleGetLocals);
router.get("/locals/:id", handleGetLocalById);
router.put("/locals/:id", handleUpdateLocal);
router.delete("/locals/:id", handleDeleteLocal);

export default router;
