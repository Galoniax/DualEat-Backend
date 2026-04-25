import cron from "node-cron";
import { prisma } from "../database/prisma/prisma";

export class SubscriptionCron {
  public start() {
    // Se ejecuta todos los días a la medianoche (00:00)
    cron.schedule("0 0 * * *", async () => {
      console.log("[CRON] Iniciando revisión de pases expirados...");
      try {
        const now = new Date();

        // 1. Buscar todas las suscripciones activas cuya end_date ya pasó
        const expiredSubscriptions = await prisma.subscription.findMany({
          where: {
            status: "active",
            end_date: {
              lt: now,
            },
          },
          select: {
            id: true,
            user_id: true,
            local_id: true,
            end_date: true,
          },
        });

        if (expiredSubscriptions.length > 0) {
          console.log(`[CRON] Se encontraron ${expiredSubscriptions.length} pases expirados. Procediendo a finalizar...`);

          const subscriptionIds = expiredSubscriptions.map((sub) => sub.id);
          const userIds = expiredSubscriptions.map((sub) => sub.user_id);

          // 2. Transacción para actualizar suscripciones y usuarios simultáneamente
          await prisma.$transaction([
            // Marca las suscripciones como finalizadas ('finished')
            prisma.subscription.updateMany({
              where: {
                id: { in: subscriptionIds },
              },
              data: {
                status: "finished",
              },
            }),
            // Cambia el estado del usuario ('INACTIVE')
            prisma.user.updateMany({
              where: {
                id: { in: userIds },
              },
              data: {
                subscription_status: "INACTIVE",
              },
            }),
          ]);

          console.log(`[CRON] ${expiredSubscriptions.length} pases finalizados correctamente.`);
        } else {
          console.log("[CRON] No hay pases expirados para procesar hoy.");
        }
      } catch (error) {
        console.error("[CRON] Error al procesar expiración de pases:", error);
      }
    });

    console.log("[CRON] SubscriptionCron registrado correctamente.");
  }
}
