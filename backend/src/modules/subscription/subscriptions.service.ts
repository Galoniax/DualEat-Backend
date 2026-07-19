import { MercadoPagoConfig, Preference, MerchantOrder } from "mercadopago";
import { prisma } from "@/core/database/prisma/prisma";
import {
  PlanDetails,
  LocalPlanType,
} from "@/shared/interfaces/mercadopago.dto";
import { SubscriptionPlan } from "@prisma/client";

import { requestClient } from "../payment/services/payment.service";
import { PreferenceRequest } from "mercadopago/dist/clients/preference/commonTypes";

// 1. Inicializar el cliente de Mercado Pago
const config = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || "",
});

const preferenceClient = new Preference(config);
const merchantOrderClient = new MerchantOrder(config);

// Definición de precios (usar montos razonables para pruebas reales)
const MONTHLY_PRICE = 1; // 100 ARS
const ANNUAL_PRICE = 8; // 800 ARS
const COMMUNITY_MONTHLY_PRICE = 2; // 2 ARS
const COMMUNITY_ANNUAL_PRICE = 15; // 15 ARS

// ----------------------------------------------------
// Lógica para obtener detalles del plan
// ----------------------------------------------------
export const getPlanDetails = (planType: SubscriptionPlan): PlanDetails => {
  const currency = "ARS";

  // TODO: Modificar valores del plan en producción
  switch (planType) {
    case "LOCAL_MONTHLY":
      return {
        frequency: 1,
        frequency_type: "months",
        amount: MONTHLY_PRICE,
        reason: "Pase Mensual de DualEat para Locales",
        currency_id: currency,
      };
    case "LOCAL_ANNUAL":
      return {
        frequency: 1,
        frequency_type: "years",
        amount: ANNUAL_PRICE,
        reason: "Pase Anual de DualEat (Pago Total)",
        currency_id: currency,
      };
    case "COMMUNITY_USER_MONTHLY":
      return {
        frequency: 1,
        frequency_type: "months",
        amount: COMMUNITY_MONTHLY_PRICE,
        reason: "Suscripción Premium Mensual de DualEat",
        currency_id: currency,
      };
    case "COMMUNITY_USER_ANNUAL":
      return {
        frequency: 1,
        frequency_type: "years",
        amount: COMMUNITY_ANNUAL_PRICE,
        reason: "Suscripción Premium Anual de DualEat",
        currency_id: currency,
      };
    default:
      throw new Error(`Plan de suscripción no válido: ${planType}`);
  }
};

export class SubscriptionService {
  constructor() {}
  // ----------------------------------------------------
  // Servicio para crear la preferencia de pago (Checkout)
  // ----------------------------------------------------
  async createLocalPreferenceCheckout(
    userId: string,
    localId: string,
    plan: LocalPlanType,
    payerEmail: string,
  ) {
    const planDetails = getPlanDetails(plan as unknown as SubscriptionPlan);

    const successUrl = `${process.env.CLIENT_URL}/business/payments/success`;
    const failureUrl = `${process.env.CLIENT_URL}/business/payments/failure`;
    const pendingUrl = `${process.env.CLIENT_URL}/business/payments/pending`;
    // USAR la URL tal cual está en env. Debe ser pública (ngrok o dominio)
    const notificationUrl = process.env.NOTIFY_URL!;

    const externalReference = `DUALEAT-TRUE_USER-${userId}_LOCAL-${localId}_PLAN-${plan}_TS-${Date.now()}`;

    let installmentLogic = {};
    if (plan === "LOCAL_ANNUAL") {
      installmentLogic = {
        installments: 12,
        excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
      };
    }

    const request: PreferenceRequest = {
      items: [
        {
          id: plan,
          title: planDetails.reason,
          quantity: 1,
          unit_price: planDetails.amount,
          currency_id: planDetails.currency_id,
        },
      ],
      external_reference: externalReference,
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl,
      },
      ...installmentLogic,
      notification_url: notificationUrl,
      payer: {
        email: payerEmail,
      },
    };

    try {
      const response = await preferenceClient.create({ body: request });

      // Determinar si estamos con token de prueba o real
      const isTestToken = Boolean(
        process.env.MP_ACCESS_TOKEN &&
        process.env.MP_ACCESS_TOKEN.startsWith("TEST-"),
      );

      // Si token de test y existe sandbox_init_point -> usar sandbox_init_point
      if (isTestToken && response.sandbox_init_point) {
        return response.sandbox_init_point;
      }

      // En modo real usar init_point si está disponible
      if (response.init_point) {
        return response.init_point;
      }

      // Fallback: si estamos en test y no hay sandbox init point pero hay init_point, devolver init_point
      if (response.sandbox_init_point) {
        return response.sandbox_init_point;
      }

      throw new Error(
        "No se pudo generar la URL de checkout de Mercado Pago. ID: " +
          response.id,
      );
    } catch (error: any) {
      throw new Error(
        `Error en la API de Mercado Pago: ${error?.message || error}`,
      );
    }
  }

  async create(
    user_id: string,
    plan: "COMMUNITY_USER_MONTHLY" | "COMMUNITY_USER_ANNUAL",
    backendBaseUrl?: string,
  ) {
    const planDetails = getPlanDetails(plan as unknown as SubscriptionPlan);

    let success = `${process.env.CLIENT_URL}/payments/success`;
    let failure = `${process.env.CLIENT_URL}/payments/failure`;
    let pending = `${process.env.CLIENT_URL}/payments/pending`;

    const user = await prisma.user.findUnique({
      where: { id: user_id },
      select: {
        email: true,
        name: true,
      },
    });

    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    if (backendBaseUrl) {
      // Si el host es una IP local o localhost, usamos la URL pública de ngrok en HTTPS
      // para que Mercado Pago acepte el auto_return sin dar error
      const baseRedirect =
        backendBaseUrl.includes("192.168") ||
        backendBaseUrl.includes("localhost") ||
        backendBaseUrl.includes("127.0.0.1")
          ? "https://f4d8-190-190-126-222.ngrok-free.app"
          : backendBaseUrl;

      success = `${baseRedirect}/api/payment/callback?status=success&type=SUBSCRIPTION&id=${user_id}`;
      failure = `${baseRedirect}/api/payment/callback?status=failure&type=SUBSCRIPTION&id=${user_id}`;
      pending = `${baseRedirect}/api/payment/callback?status=pending&type=SUBSCRIPTION&id=${user_id}`;
    }

    // Usamos LOCAL-NONE para indicar que no es para un comercio específico
    const reference = `DUALEAT_USER-${user_id}_LOCAL-NONE_PLAN-${plan}`;

    let installmentLogic = {};
    if (plan === "COMMUNITY_USER_ANNUAL") {
      installmentLogic = {
        installments: 12,
        excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
      };
    }

    const request: PreferenceRequest = {
      items: [
        {
          id: plan,
          title: planDetails.reason,
          quantity: 1,
          description: "Suscripción Premium DualEat",
          unit_price: planDetails.amount,
          currency_id: planDetails.currency_id,
        },
      ],
      auto_return: "approved",
      binary_mode: true,
      statement_descriptor: "DUALEAT",
      external_reference: reference,
      back_urls: {
        success: success,
        failure: failure,
        pending: pending,
      },
      ...installmentLogic,
      payer: {
        email: user.email,
        name: user.name,
      },
    };

    try {
      const response = await requestClient(request);

      return response;
    } catch (e: any) {
      throw new Error(`Error en la API de Mercado Pago: ${e}`);
    }
  }

  /**
   * Obtiene la suscripción activa (o la más reciente) de un local por su ID.
   */
  async getLocalSubscription(localId: string) {
    if (!localId) {
      throw new Error("Local ID es requerido para obtener la suscripción.");
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        local_id: localId,
        subscription_type: "LOCAL",
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return subscription;
  }

  /**
   * Cambia el estado de auto_renew para una suscripción.
   */
  async updateLocalSubscriptionAutoRenew(localId: string, autoRenew: boolean) {
    if (!localId) {
      throw new Error("Local ID es requerido para actualizar la suscripción.");
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        local_id: localId,
        subscription_type: "LOCAL",
      },
      orderBy: {
        created_at: "desc",
      },
    });

    if (!subscription) {
      throw new Error("Suscripción no encontrada para este local.");
    }

    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        auto_renew: autoRenew,
        updated_at: new Date(),
      },
    });

    return updatedSubscription;
  }
}
