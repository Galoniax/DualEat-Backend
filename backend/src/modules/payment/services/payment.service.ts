import AuthSessionService from "@/modules/auth/services/auth-session.service";
import MercadoPagoConfig, {
  MerchantOrder,
  Payment,
  Preference,
  OAuth,
} from "mercadopago";

import { prisma } from "@/core/database/prisma/prisma";
import {
  NotificationContentType,
  OrderStatus,
  SubscriptionPlan,
  SubscriptionStateMP,
} from "@prisma/client";
import {
  PlanDetails,
} from "@/shared/interfaces/mercadopago.dto";
import { getSocketServer } from "@/core/config/socket.config";
import { NotificationService } from "@/modules/notification/services/notification.service";
import { PreferenceRequest } from "mercadopago/dist/clients/preference/commonTypes";
import { getPlanDetails } from "@/modules/subscription/subscriptions.service";

const config = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || "",
});

const orderClient = new MerchantOrder(config);
const oauth = new OAuth(config);

export async function requestClient(
  request: PreferenceRequest,
  accessToken?: string,
) {
  const targetToken = accessToken || process.env.MP_ACCESS_TOKEN || "";
  const config = new MercadoPagoConfig({ accessToken: targetToken });
  const client = new Preference(config);

  /*const url =
    process.env.NOTIFY_URL ||
    "https://f4d8-190-190-126-222.ngrok-free.app/api/payment/notification";*/

  const url = "https://4edc-190-190-126-222.ngrok-free.app/api/payment/notification";

  request.notification_url = `${url}`;

  try {
    console.log("URL de notificación:", request.notification_url);

    const response = await client.create({ body: request });

    const isDevelopment = process.env.NODE_ENV !== "production";
    let checkoutUrl = response.init_point;

    if (isDevelopment && response.sandbox_init_point) {
      checkoutUrl = response.sandbox_init_point;
    } else if (response.sandbox_init_point && !response.init_point) {
      checkoutUrl = response.sandbox_init_point;
    }

    if (!checkoutUrl) {
      throw new Error("No se pudo generar la URL de checkout de Mercado Pago.");
    }

    return checkoutUrl;
  } catch (e: any) {
    throw new Error(`Error en la API de Mercado Pago: ${e?.message || e}`);
  }
}

export class PaymentService {
  constructor() {}

  async getMerchantOrderInfo(order_id: string, retries = 5, delayMs = 3000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await orderClient.get({ merchantOrderId: order_id });
        console.log(`Merchant Order ${order_id} obtenido exitosamente`);
        return result;
      } catch (error: any) {
        if (
          error?.message &&
          (error.message.includes("not found") || error.message.includes("404"))
        ) {
          if (attempt < retries) {
            console.warn(
              `Merchant Order ${order_id} no encontrado. Reintentando en ${delayMs}ms... (${attempt}/${retries})`,
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            continue;
          } else {
            console.warn(
              `Merchant Order ${order_id} no encontrado después de ${retries} intentos.`,
            );
            return null;
          }
        }
        throw new Error(
          `Error al obtener la información de merchant_order desde MP: ${error?.message || error}`,
        );
      }
    }

    return null;
  }

  processingPayments = new Set<string>();

  async processPaymentApproval(externalRef: string, paymentId: string) {
    if (this.processingPayments.has(paymentId)) {
      console.log(
        `[LOCK] El pago ${paymentId} ya está siendo procesado concurrentemente. Ignorando.`,
      );
      return null;
    }
    this.processingPayments.add(paymentId);

    try {
      // 1. Parseo robusto de la Referencia Externa
      const map: { [key: string]: string } = {};

      const regex = /(DUALEAT|USER|LOCAL|PLAN)-([A-Za-z0-9_]+)(?=_|$)/g;
      let match;

      while ((match = regex.exec(externalRef)) !== null) {
        map[match[1]] = match[2];
      }

      const user_id = map["USER"];
      const local_id = map["LOCAL"];
      const plan = map["PLAN"] as SubscriptionPlan;

      // 2. Verificación de integridad de los datos
      if (!user_id || !local_id || !plan) {
        throw new Error(
          `Formato de referencia externa incompleto o no válido`,
        );
      }

      const isCommunityUser =
        plan === SubscriptionPlan.COMMUNITY_USER_MONTHLY ||
        plan === SubscriptionPlan.COMMUNITY_USER_ANNUAL;
      const subscriptionType = isCommunityUser ? "COMMUNITY_USER" : "LOCAL";
      const targetLocalId =
        isCommunityUser || local_id === "NONE" ? null : local_id;

      const existing = await prisma.subscription.findFirst({
        where: {
          user_id: user_id,
          local_id: targetLocalId,
          subscription_type: subscriptionType,
        },
        orderBy: { created_at: "desc" },
      });

      console.log("existingSubscription", existing)

      // GESTIÓN DE PAGO DUPLICADO: Verificamos si este pago específico ya fue procesado
      let isDuplicatePayment = false;
      if (existing) {
        if (existing.mp_preapproval_id === paymentId) {
          isDuplicatePayment = true;
        } else if (existing.payment_history && Array.isArray(existing.payment_history)) {
          isDuplicatePayment = existing.payment_history.some(
            (item: any) => item && item.reference_id === paymentId,
          );
        } else if (existing.payment_history && typeof existing.payment_history === "object") {
          const historyObj = existing.payment_history as any;
          if (historyObj.reference_id === paymentId) {
            isDuplicatePayment = true;
          }
        }
      }

      if (isDuplicatePayment) {
        console.log(
          `El pago ${paymentId} para la suscripción ${subscriptionType} ya fue procesado anteriormente. Ignorando webhook duplicado.`,
        );
        return existing;
      }

      const planDetails = getPlanDetails(plan);

      // 3. Determinar las fechas y AUTO_RENEW PREDETERMINADO
      const startDate = new Date();
      const nextPaymentDate = new Date(startDate);
      let auto_renew = false;

      if (
        plan === SubscriptionPlan.LOCAL_MONTHLY ||
        plan === SubscriptionPlan.COMMUNITY_USER_MONTHLY
      ) {
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
        auto_renew = false;
      } else if (
        plan === SubscriptionPlan.LOCAL_ANNUAL ||
        plan === SubscriptionPlan.COMMUNITY_USER_ANNUAL
      ) {
        nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);
        auto_renew = false;
      }

      // 4. Agregar elemento al historial de pagos
      const paymentHistoryItem = {
        date: new Date().toISOString(),
        amount: planDetails.amount,
        status: "approved",
        reference_id: paymentId,
      };

      let updatedPaymentHistory: any[] = [];
      if (existing?.payment_history) {
        if (Array.isArray(existing.payment_history)) {
          updatedPaymentHistory = [
            ...existing.payment_history,
            paymentHistoryItem,
          ];
        } else {
          updatedPaymentHistory = [
            existing.payment_history,
            paymentHistoryItem,
          ];
        }
      } else {
        updatedPaymentHistory = [paymentHistoryItem];
      }

      // 5. Crear/Actualizar la Suscripción sin usar upsert con valores null
      let subscription;
      if (existing) {
        subscription = await prisma.subscription.update({
          where: { id: existing.id },
          data: {
            mp_preapproval_id: paymentId,
            plan: plan,
            amount: planDetails.amount,
            status: SubscriptionStateMP.active,
            start_date: startDate,
            next_payment_date: nextPaymentDate,
            end_date: nextPaymentDate,
            auto_renew: auto_renew,
            payment_history: updatedPaymentHistory,
            updated_at: new Date(),
          },
        });
      } else {
        subscription = await prisma.subscription.create({
          data: {
            mp_preapproval_id: paymentId,
            user_id: user_id,
            local_id: targetLocalId,

            subscription_type: subscriptionType,
            plan: plan,
            amount: planDetails.amount,
            status: SubscriptionStateMP.active,
            start_date: startDate,
            next_payment_date: nextPaymentDate,
            end_date: nextPaymentDate,
            auto_renew: auto_renew,
            payment_history: updatedPaymentHistory,
          },
        });
      }

      // 6. Actualizar el estado de suscripción del usuario a 'ACTIVE' en la DB
      await prisma.user.update({
        where: { id: user_id },
        data: { subscription_status: "ACTIVE" },
      });
      
      console.log(
        `Suscripción creada/actualizada exitosamente:`,
        subscription,
      );

      return subscription;
    } finally {
      this.processingPayments.delete(paymentId);
    }
  }

  async processOrderPaymentApproval(externalRef: string, paymentId: string) {
    if (this.processingPayments.has(paymentId)) {
      console.log(
        `[LOCK] El pago de la orden ${paymentId} ya está siendo procesado concurrentemente. Ignorando.`,
      );
      return null;
    }
    this.processingPayments.add(paymentId);

    try {
      // 1. Extraer el ID de la orden de la referencia externa: DUALEAT-ORDER-${orderId}
      const order_id = externalRef.replace("DUALEAT-ORDER-", "");

      if (!order_id) {
        throw new Error(
          `Referencia externa de orden no válida: ${externalRef}`,
        );
      }

      // 2. Buscar la orden en la base de datos
      const order = await prisma.order.findUnique({
        where: { id: order_id },
      });

      if (!order) {
        throw new Error(`Orden no encontrada para ID: ${order_id}`);
      }

      // 3. Si la orden ya está procesada (no es PENDING), ignoramos
      if (order.status !== "IN_PROGRESS") {
        console.log(
          `Orden ${order_id} ya está procesada con estado: ${order.status}. Ignorando webhook duplicado.`,
        );
        return order;
      }

      // Generar un código único de 6 dígitos para el local
      let code = "";
      let isUnique = false;

      while (!isUnique) {
        code = Math.floor(10000000 + Math.random() * 90000000).toString();

        const existing = await prisma.order.findFirst({
          where: {
            local_id: order.local_id,
            short_code: code,
          },
        });

        if (!existing) {
          isUnique = true;
        }
      }

      // 4. Actualizar estado de la orden a PAID en la base de datos
      const updatedOrder = await prisma.order.update({
        where: { id: order_id },
        data: {
          status: OrderStatus.PAID,
          payment_method: `MERCADOPAGO (${paymentId})`,
          short_code: code,
          updated_at: new Date(),
        },
        include: {
          order_items: {
            include: { food: true },
          },
        },
      });

      // 5. Notificar al local (Notificación flotante en DB y sockets)
      try {
        const local_id = order.local_id;
        const localUsers = await prisma.localUser.findMany({
          where: { local_id: local_id, role: "admin" },
        });

        const io = getSocketServer();
        const service = new NotificationService();

        const notification = await service.create({
          user_id: order.user_id!,
          content_type: NotificationContentType.ORDER,
          title: "Realizaste una nueva orden",
          content_id: order.id,
          message: `Tu orden #"${order.id}" ha sido creada. Muestre el código QR en el local para retirarla.`,
        });

        for (const lu of localUsers) {
          const notification = await service.create({
            user_id: lu.user_id,
            content_type: "ORDER",
            title: "Nueva Orden Pagada",
            content_id: order_id,
            message: `Nueva Orden Pagada. Ganancia: $${Number(updatedOrder.total).toFixed(2)}`,
            metadata: {
              type: "order_status",
              order_id,
              status: "PAID",
              total: Number(updatedOrder.total),
            },
          });
          io.to(lu.user_id).emit("new_notification", notification);
        }

        // Notificar a todos los usuarios del local sobre la actualización de estado para recarga en tiempo real
        const localUsersAll = await prisma.localUser.findMany({
          where: { local_id: local_id },
          select: { user_id: true },
        });
        const recipientIdsAll = localUsersAll.map((lu) => lu.user_id);
        if (recipientIdsAll.length > 0) {
          io.to(recipientIdsAll).emit("order_status_updated", {
            order_id,
            status: "PAID",
            local_id,
          });
        }
      } catch (notifyError) {
        console.error(
          "Error al notificar al local sobre la orden pagada:",
          notifyError,
        );
      }

      return updatedOrder;
    } finally {
      this.processingPayments.delete(paymentId);
    }
  }

  async getPaymentInfo(paymentId: string, retries = 15, delayMs = 3000) {
    const client = new Payment(config);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(
          `[MP API] Intento ${attempt}/${retries} de obtener pago ${paymentId}`,
        );
        const paymentInfo = await client.get({ id: paymentId });
        console.log(
          `[MP API] Pago ${paymentId} obtenido exitosamente - Estado: ${paymentInfo.status}`,
        );
        return paymentInfo;
      } catch (error: any) {
        if (attempt === 1 || attempt === retries) {
          console.error(`[MP API] Error en intento ${attempt}/${retries}:`, {
            message: error?.message,
            status: error?.status,
            code: error?.cause?.[0]?.code,
          });
        }

        if (error?.message && error.message.includes("Payment not found")) {
          if (attempt < retries) {
            if (attempt === 1) {
              console.warn(
                `[MP API] Pago ${paymentId} no sincronizado aún. Reintentando...`,
              );
            }
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            continue;
          } else {
            console.warn(
              `[MP API] Pago ${paymentId} no encontrado después de ${retries} intentos (${(retries * delayMs) / 1000}s).`,
            );
            return null;
          }
        }

        if (error?.status === 401 || error?.status === 403) {
          console.error(
            `[MP API] Error de autenticación/autorización. Verifica tu Access Token.`,
          );
          throw new Error(
            `Error de autenticación con Mercado Pago: ${error.message}`,
          );
        }

        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        throw new Error(
          `Error al obtener la información del pago desde MP: ${error?.message || error}`,
        );
      }
    }

    return null;
  }

  // CREACIÓN/REFRESH DE TOKENS
  // =========================================================
  async createOauth(code: string, redirectUri: string) {
    const client_secret = process.env.MP_CLIENT_SECRET || "APP_USR-6323842828937796-061123-e4f75fe6e41e645a5191340349ccf71e-3468655592";
    const client_id = process.env.MP_CLIENT_ID || "6323842828937796";

    try {
      const response = await oauth.create({
        body: {
          client_secret: client_secret,
          client_id: client_id,
          code,
          redirect_uri: redirectUri,
        },
      });
      return response;
    } catch (e: any) {
      throw new Error(e || "Error al obtener tokens de Mercado Pago");
    }
  }

  async refreshToken(local_id: string) {
    const credentials = await prisma.credentials.findUnique({
      where: { local_id: local_id },
    });

    if (!credentials) {
      throw new Error(
        `No se encontraron credenciales para el local: ${local_id}`,
      );
    }

    const clientSecret =
      process.env.MP_CLIENT_SECRET || "APP_USR-6323842828937796-061123-e4f75fe6e41e645a5191340349ccf71e-3468655592";
    const client_id = process.env.MP_CLIENT_ID || "6323842828937796";

    try {
      const response = await oauth.refresh({
        body: {
          client_secret: clientSecret,
          client_id,
          refresh_token: credentials.refresh_token,
        },
      });

      const updated = await prisma.credentials.update({
        where: { local_id: local_id },
        data: {
          access_token: response.access_token!,
          refresh_token: response.refresh_token!,
          public_key: response.public_key!,
          user_id_mp: response.user_id!.toString(),
          expires_in: response.expires_in!,
          updated_at: new Date(),
        },
      });

      return updated.access_token;
    } catch (error: any) {
      console.error(
        `Error al refrescar token usando SDK de MP para local ${local_id}:`,
        error,
      );
      throw new Error(error?.message || error || "Error al refrescar token");
    }
  }

  async getRefreshToken(local_id: string): Promise<string | undefined> {
    const credentials = await prisma.credentials.findUnique({
      where: { local_id: local_id },
    });

    if (!credentials) return undefined;

    const expirationTime =
      credentials.updated_at.getTime() + credentials.expires_in * 1000;
    const now = Date.now();

    // Si faltan menos de 24 horas (86400 segundos) para que expire, o si ya expiró, lo refrescamos
    const margin = 24 * 60 * 60 * 1000;
    if (expirationTime - now < margin) {
      console.log(
        `El token del local ${local_id} está próximo a expirar o expiró. Iniciando refresco automático.`,
      );
      try {
        return await this.refreshToken(local_id);
      } catch (e: any) {
        return credentials.access_token;
      }
    }

    return credentials.access_token;
  }
}
