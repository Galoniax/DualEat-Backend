import { Request, Response } from "express";
import { LocalPlanType } from "../../shared/interfaces/mercadopago.dto";
import { SubscriptionPlan, User } from "@prisma/client";
import { SubscriptionService } from "./subscriptions.service";

export class SubscriptionController {
  constructor(private service: SubscriptionService) {}

  // Manejador del Checkout (POST /local-checkout)
  // =========================================================
  handleLocalSubscriptionCheckout = async (req: Request, res: Response) => {
    const { userId, payerEmail, localId, plan } = req.body;

    if (!userId || !localId || !plan || !payerEmail) {
      return res.status(400).json({
        message:
          "Faltan datos requeridos: userId, localId, plan, o payerEmail.",
      });
    }

    if (plan !== "LOCAL_MONTHLY" && plan !== "LOCAL_ANNUAL") {
      return res
        .status(400)
        .json({ message: "El plan seleccionado no es válido." });
    }

    try {
      const checkoutUrl = await this.service.createLocalPreferenceCheckout(
        userId,
        localId,
        plan as LocalPlanType,
        payerEmail,
      );

      return res.status(200).json({
        success: true,
        checkoutUrl,
        message: "URL de checkout generada con éxito.",
      });
    } catch (error) {
      console.error("Error al procesar la solicitud de suscripción:", error);
      const errorMessage =
        (error as Error).message ||
        "Error interno al comunicarse con Mercado Pago.";
      return res.status(500).json({
        message: errorMessage,
      });
    }
  };

  // Manejador del Checkout para Usuarios (POST /user-checkout)
  // =========================================================
  create = async (req: Request, res: Response) => {
    const { plan } = req.body;

    const user = ((req as any).user || req.body.user) as User;

    if (!user || !plan) {
      return res.status(400).json({
        message: "Faltan datos requeridos: userId, plan, o payerEmail.",
      });
    }

    if (
      plan !== SubscriptionPlan.COMMUNITY_USER_MONTHLY &&
      plan !== SubscriptionPlan.COMMUNITY_USER_ANNUAL
    ) {
      return res
        .status(400)
        .json({ message: "El plan seleccionado no es válido." });
    }

    try {
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.get("host");
      const backendBaseUrl = `${protocol}://${host}`;

      const checkoutUrl = await this.service.create(
        user,
        plan,
        backendBaseUrl,
      );

      return res.status(200).json({
        success: true,
        checkoutUrl,
        message: "URL de checkout para usuario generada con éxito.",
      });
    } catch (e: any) {
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Error interno al comunicarse con Mercado Pago.",
      });
    }
  };

  // Manejador de Redirección (GET /payments/mercadopago/verify)
  // =========================================================
  verifyPayment = async (req: Request, res: Response) => {
    const { payment_id, collection_status } = req.query;

    if (collection_status === "approved") {
      return res.redirect(
        `${process.env.CLIENT_URL}/business/dashboard?status=success&payment_id=${payment_id}`,
      );
    } else if (collection_status === "pending") {
      return res.redirect(
        `${process.env.CLIENT_URL}/business/dashboard?status=pending&payment_id=${payment_id}`,
      );
    } else {
      return res.redirect(
        `${process.env.CLIENT_URL}/business/dashboard?status=failure`,
      );
    }
  };

  // Manejador para obtener la suscripción (GET /local/:localId)
  // =========================================================
  getLocalSubscription = async (req: Request, res: Response) => {
    const { localId } = req.params;

    if (!localId) {
      return res.status(400).json({ message: "Local ID es requerido." });
    }

    try {
      const subscription = await this.service.getLocalSubscription(
        localId as string,
      );

      if (!subscription) {
        return res.status(200).json(null);
      }

      return res.status(200).json(subscription);
    } catch (error) {
      console.error("Error al obtener la suscripción:", error);
      return res
        .status(500)
        .json({ message: "Error interno al obtener la suscripción." });
    }
  };

  // Manejador para actualizar auto_renew (PUT /local/toggle-renew)
  // =========================================================
  toggleAutoRenew = async (req: Request, res: Response) => {
    const { localId, autoRenew } = req.body;

    if (!localId || typeof autoRenew !== "boolean") {
      return res
        .status(400)
        .json({ message: "Local ID y autoRenew (boolean) son requeridos." });
    }

    try {
      const updatedSubscription =
        await this.service.updateLocalSubscriptionAutoRenew(localId, autoRenew);

      return res.status(200).json(updatedSubscription);
    } catch (error: any) {
      console.error("Error al actualizar auto-renew:", error);
      return res.status(500).json({ message: error.message });
    }
  };
}
