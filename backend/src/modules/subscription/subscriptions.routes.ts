import { Router } from "express";
import { SubscriptionController } from "./subscriptions.controller";
import { SubscriptionService } from "./subscriptions.service";
import { isAuthenticated } from "@/core/middlewares/isAuthenticated";

const router = Router();
const controller = new SubscriptionController(new SubscriptionService());

router.post(
  "/local-checkout",
  controller.handleLocalSubscriptionCheckout.bind(controller),
);
router.post(
  "/user-checkout",
  isAuthenticated,
  controller.create.bind(controller),
);
router.get("/local/:localId", controller.getLocalSubscription.bind(controller));
router.put("/local/toggle-renew", controller.toggleAutoRenew.bind(controller));

// Webhooks de Mercado Pago
router.get(
  "/payments/mercadopago/verify",
  controller.verifyPayment.bind(controller),
);

export default router;
