import { Router } from "express";
import { RecipeController } from "./recipe.controller";

import { isAuthenticated } from "../../core/middlewares/isAuthenticated";
import { RecipeService } from "./recipe.service";

const router = Router();

const service = new RecipeService();
const controller = new RecipeController(service);

// 1. Obtener todos los ingredientes
// =========================================================
router.get("/ingredients", controller.getAllIngredients.bind(controller));

// 2. Obtener recetas del usuario
// =========================================================
router.get(
  "/user",
  isAuthenticated,
  controller.getUserRecipes.bind(controller),
);

// 3. Obtener receta por Id
// =========================================================
router.get("/:id", controller.getById.bind(controller));

// 4. Obtener recetas por Ids
// =========================================================
router.get("/", controller.getByIds.bind(controller));

// 5. Buscar recetas por nombre (PAGINATION)
// =========================================================
router.get("/search", controller.searchRecipes.bind(controller));

export default router;
