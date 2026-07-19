import { Request, Response } from "express";
import { PaymentService } from "../services/payment.service";
import { prisma } from "@/core/database/prisma/prisma";

export class PaymentController {
  constructor(private service: PaymentService) {}

  // HANDLER DE NOTIFICACIONES DE MERCADO PAGO
  // =========================================================
  paymentNotification = async (req: Request, res: Response) => {
    const query = req.query.topic || req.query.type;
    const body = req.body?.topic || req.body?.type;

    const topic = query || body;

    if (!topic) {
      console.log("Webhook recibido sin topic/type - ignorando");
      return res.sendStatus(200);
    }

    const notification = topic.toString();

    try {
      // CASO 1: Notificación de MERCHANT_ORDER
      if (notification === "merchant_order") {
        const order_id =
          req.query.id?.toString() || req.body?.data?.id || req.body?.id;

        if (!order_id) {
          console.log("merchant_order sin ID");
          return res.sendStatus(200);
        }

        // Reintentar obtener merchant order con delays
        const merchantOrder = await this.service.getMerchantOrderInfo(
          order_id,
          5,
          3000,
        );

        if (!merchantOrder) {
          console.log(
            `[SYNC FAIL] No se pudo obtener merchant_order ${order_id}`,
          );
          return res.sendStatus(200);
        }

        console.log(
          `Merchant Order - Status: ${merchantOrder.order_status}, Payments:`,
          merchantOrder.payments,
        );

        // Si el merchant order aún no tiene pagos, esperar
        if (!merchantOrder.payments || merchantOrder.payments.length === 0) {
          console.log(
            `Merchant order ${order_id} aún sin pagos. MP reenviará cuando se procese.`,
          );
          return res.sendStatus(200);
        }

        // Verificar si hay pagos aprobados en la orden
        const payment = merchantOrder.payments?.find(
          (p: any) => p.status === "approved",
        );

        if (payment?.id && merchantOrder.external_reference) {
          const paymentIdStr = payment.id.toString();
          console.log(
            "Pago aprobado encontrado en merchant_order:",
            paymentIdStr,
          );
          const extRef = merchantOrder.external_reference;
          if (extRef.startsWith("DUALEAT-ORDER-")) {
            await this.service.processOrder(extRef, paymentIdStr);
            console.log(`Pedido pagado para ref: ${extRef}`);
          } else {
            await this.service.processSubscription(extRef, paymentIdStr);
            console.log(`Suscripción activada para ref: ${extRef}`);
          }
        } else {
          console.log(
            `Merchant order con pagos pero ninguno aprobado aún. Estado: ${merchantOrder.order_status}`,
          );
        }

        return res.sendStatus(200);
      }

      // CASO 2: Notificación de PAYMENT (flujo original)
      if (notification === "payment") {
        const paymentId =
          req.body?.data?.id ||
          req.query["data.id"] ||
          req.query.id?.toString();

        if (!paymentId) {
          console.log("payment sin ID");
          return res.sendStatus(200);
        }

        console.log(`Procesando Payment ID: ${paymentId}`);

        // En sandbox, aumentamos reintentos porque la sincronización es lenta
        const paymentInfo = await this.service.getPaymentInfo(
          paymentId.toString(),
          15,
          3000,
        );

        if (!paymentInfo) {
          console.log(
            `Pago ${paymentId} aún no disponible. MP reenviará webhook de merchant_order.`,
          );
          return res.sendStatus(200);
        }

        console.log(`MP Info: Estado ${paymentInfo.status}, ID: ${paymentId}`);

        if (
          paymentInfo.status === "approved" &&
          paymentInfo.external_reference
        ) {
          const extRef = paymentInfo.external_reference;
          if (extRef.startsWith("DUALEAT-ORDER-")) {
            console.log("ENTREGAASFSDFJKSDF");
            await this.service.processOrder(extRef, paymentId.toString());
            console.log(
              `Pago aprobado y pedido confirmado para ref: ${extRef}`,
            );
          } else {
            await this.service.processSubscription(
              extRef,
              paymentId.toString(),
            );
            console.log(
              `Pago aprobado y suscripción activada para ref: ${extRef}`,
            );
          }
        } else {
          console.log(
            `Pago no aprobado. Estado: ${paymentInfo.status}. ID: ${paymentId}. DB no actualizada.`,
          );
        }

        return res.sendStatus(200);
      }

      return res.sendStatus(200);
    } catch (e: any) {
      return res.sendStatus(500);
    }
  };

  // CALLBACK DE AUTHENTICATION
  // =========================================================
  oauthCallback = async (req: Request, res: Response) => {
    const { code, state: localId } = req.query;

    if (!code || !localId) {
      return res.redirect(
        `${process.env.CLIENT_URL}/business/dashboard?mp_connect=error`,
      );
    }

    try {
      // Intentar construir el redirect_uri dinámicamente según el host que realiza la solicitud,
      // o usar una variable específica MP_REDIRECT_URI si está definida.
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.get("host");
      const defaultRedirectUri = `${protocol}://${host}/api/payment/oauth/callback`;
      const redirectUri = process.env.MP_REDIRECT_URI || defaultRedirectUri;

      console.log(
        "OAuth Callback - Iniciando intercambio con redirect_uri:",
        redirectUri,
      );

      const data = await this.service.createOauth(code.toString(), redirectUri);

      const creds = await prisma.credentials.upsert({
        where: { local_id: localId.toString() },
        update: {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          public_key: data.public_key,
          user_id_mp: data.user_id!.toString(),
          expires_in: data.expires_in!,
          updated_at: new Date(),
        },
        create: {
          local_id: localId.toString(),
          access_token: data.access_token!,
          refresh_token: data.refresh_token!,
          public_key: data.public_key!,
          user_id_mp: data.user_id!.toString(),
          expires_in: data.expires_in!,
        },
      });

      if (!creds) {
        throw new Error("Error al guardar las credenciales");
      }

      return res.status(200).json({
        success: true,
        message: "Mercado Pago del local vinculado exitosamente.",
      });
    } catch (e: any) {
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Error al vincular Mercado Pago del local.",
      });
    }
  };
}
