import { Router } from "express";
import { PaymentController } from "../controllers/payment.controller";
import { PaymentService } from "../services/payment.service";

const router = Router();
const controller = new PaymentController(new PaymentService());

// Webhook de notificaciones Mercado Pago (Suscripciones y Órdenes)
router.post("/notification", controller.paymentNotification.bind(controller));

// Callback de vinculación de cuenta Mercado Pago (OAuth)
router.get("/oauth/callback", controller.oauthCallback.bind(controller));

// Callback de redirección de pagos para móviles (Bridge a Deep Link)
router.get("/callback", controller.paymentRedirectCallback.bind(controller));

export default router;
