import { Router } from "express";

import { ChatController } from "@/modules/chat/controllers/chat.controller";
import { RecipeService } from "@/modules/recipe/recipe.service";

import { isAuthenticated } from "@/core/middlewares/isAuthenticated";
import { requireSubscription } from "@/core/middlewares/requireSubscription";
import { limiter } from "@/core/middlewares/rateLimiter";

const router = Router();

const service = new RecipeService();
const controller = new ChatController(service);

// 1. Realizar pregunta a AI e iniciar/continuar chat
// =========================================================
router.post(
  "/ask",
  isAuthenticated,
  requireSubscription,
  limiter(true),
  controller.ask.bind(controller),
);

// 2. Editar título del chat
// =========================================================
router.patch(
  "/:chat_id/title",
  isAuthenticated,
  controller.editTitle.bind(controller),
);

// 3. Actualizar receta del chat
// =========================================================
router.patch(
  "/recipe",
  isAuthenticated,
  controller.updateRecipe.bind(controller),
);

// 4. Eliminar todos los chats
// =========================================================
router.delete("/", isAuthenticated, controller.deleteAll.bind(controller));

// 5. Obtener todos los chats del usuario
// =========================================================
router.get("/", isAuthenticated, controller.getUserChats.bind(controller));

// 6. Eliminar un chat por ID
// =========================================================
router.delete("/:chat_id", isAuthenticated, controller.delete.bind(controller));

// 7. Obtener chat por ID
// =========================================================
router.get("/:chat_id", isAuthenticated, controller.getById.bind(controller));

export default router;
