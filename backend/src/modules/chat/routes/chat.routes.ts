import { Router } from "express";

import { ChatController } from "../controllers/chat.controller";
import { RecipeService } from "../../recipe/recipe.service";

import { isAuthenticated } from "../../../core/middlewares/isAuthenticated";
import { limiter } from "../../../core/middlewares/rateLimiter";

const router = Router();

const service = new RecipeService();
const controller = new ChatController(service);

// 1. Realizar pregunta a AI e iniciar/continuar chat
// =========================================================
router.post(
  "/ask",
  isAuthenticated,
  limiter(true),
  controller.ask.bind(controller),
);

// 2. Obtener chat por ID
// =========================================================
router.get("/:chat_id", isAuthenticated, controller.getById.bind(controller));

// 3. Obtener chats del usuario
// =========================================================
router.get("/", isAuthenticated, controller.getUserChats.bind(controller));

// 4. Editar titulo del chat
// =========================================================
router.put("/:chat_id/title", isAuthenticated, controller.editTitle.bind(controller));

// 5. Eliminar chat
// =========================================================
router.delete("/:chat_id", isAuthenticated, controller.deleteChat.bind(controller));

// 6. Eliminar todos los chats
// =========================================================
router.delete("/", isAuthenticated, controller.deleteAllChats.bind(controller));

export default router;
