import { Router } from "express";
import { NotificationController } from "../controllers/notification.controller";
import { NotificationService } from "../services/notification.service";

import { isAuthenticated } from "@/core/middlewares/isAuthenticated";

const router = Router();
const service = new NotificationService();
const controller = new NotificationController(service);

// 1. Obtener notificaciones de un usuario
// =========================================================
router.get("/", isAuthenticated, controller.getAll.bind(controller));

// 2. Contar notificaciones no leidas de un usuario
// =========================================================
router.get("/unread-count", isAuthenticated, controller.getUnreadCount.bind(controller));

// 3. Cambiar estado de recibir notificaciónes
// =========================================================
router.put("/status", isAuthenticated, controller.changeStatus.bind(controller));

// 4. Marcar todo como leido
// =========================================================
router.patch("/mark-all-as-read", isAuthenticated, controller.markAllAsRead.bind(controller));

// 5. Marcar una notificación como leida
// =========================================================
router.put("/read", isAuthenticated, controller.markAsRead.bind(controller));

// 6. Eliminar todas las notificaciónes
// =========================================================
router.delete("/", isAuthenticated, controller.deleteAll.bind(controller));

// 7. Eliminar una notificación
// =========================================================
router.delete("/:id", isAuthenticated, controller.delete.bind(controller));


export default router;