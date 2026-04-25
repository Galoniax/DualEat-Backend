import { Router } from "express";
import { handleCreateBusinessUserAndLocal, handleGetAdminStats, handleGetUsers, handleToggleUserStatus } from "../controllers/admin.controller";
import {
  handleGetLocals,
  handleGetLocalById,
  handleUpdateLocal,
  handleDeleteLocal,
} from "../controllers/local.controller";

import { isAdmin } from '../core/middlewares/isAdmin';
import { isAuthenticated } from '../core/middlewares/isAuthenticated';

const router = Router();

// Rutas para Usuarios
router.get("/users", handleGetUsers);
router.put("/users/:id/status", handleToggleUserStatus);
router.post("/business", handleCreateBusinessUserAndLocal);
router.get("/dashboard/stats", handleGetAdminStats);

import { FoodCategoryController } from "../modules/menu/controllers/food-category.controller";
import { FoodCategoryService } from "../modules/menu/services/category.service";

const foodCategoryService = new FoodCategoryService();
const foodCategoryController = new FoodCategoryController(foodCategoryService);

// Rutas para Locales
router.get("/locals", handleGetLocals);
router.get("/locals/:id", handleGetLocalById);
router.put("/locals/:id", handleUpdateLocal);
router.delete("/locals/:id", handleDeleteLocal);

// Rutas para Food Categories (Base de datos global)
router.get("/food-categories", foodCategoryController.handleGetAllFoodCategories);
router.post("/food-categories", foodCategoryController.handleCreateFoodCategory);
router.put("/food-categories/:id", foodCategoryController.handleUpdateFoodCategory);
router.delete("/food-categories/:id", foodCategoryController.handleDeleteFoodCategory);

export default router;
