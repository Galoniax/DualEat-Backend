import cron, { ScheduledTask } from "node-cron";
import { prisma } from "@/core/database/prisma/prisma";

export class CleanupJob {
  private isRunning: boolean;
  private notificationTask: ScheduledTask | null;
  private ordersTask: ScheduledTask | null;

  constructor() {
    this.isRunning = false;
    this.notificationTask = null;
    this.ordersTask = null;
  }

  start() {
    // Tarea diaria de limpieza de notificaciones a medianoche
    this.notificationTask = cron.schedule(
      "0 0 * * *",
      async () => {
        console.log("Ejecutando tarea de limpieza diaria de notificaciones...");
        await this.NotificationCleanup();
      },
      { timezone: "America/Argentina/Buenos_Aires" }
    );

    // Tarea horaria de limpieza de órdenes en progreso (checkout) abandonadas
    this.ordersTask = cron.schedule(
      "0 * * * *",
      async () => {
        console.log("Ejecutando tarea de limpieza de órdenes abandonadas (IN_PROGRESS)...");
        await this.AbandonedOrdersCleanup();
      },
      { timezone: "America/Argentina/Buenos_Aires" }
    );
  }

  async AbandonedOrdersCleanup() {
    try {
      const expirationLimit = new Date();
      // Las órdenes en checkout (IN_PROGRESS) de más de 1 hora se consideran abandonadas
      expirationLimit.setHours(expirationLimit.getHours() - 1);

      const result = await prisma.order.deleteMany({
        where: {
          status: "IN_PROGRESS",
          created_at: { lt: expirationLimit },
        },
      });

      console.log(`[CLEANUP] Se eliminaron ${result.count} órdenes abandonadas en checkout (estado IN_PROGRESS).`);
    } catch (error) {
      console.error("Error durante la limpieza de órdenes abandonadas:", error);
    }
  }

  async NotificationCleanup() {
    if (this.isRunning) {
      console.log("La tarea de limpieza ya está en ejecución.");
      return;
    }
    this.isRunning = true;
    try {
      const date = new Date();
      date.setDate(date.getDate() - 30);

      const result = await prisma.notification.deleteMany({
        where: {
          created_at: { lt: date },
          read: true, // Corregido: usualmente se limpian notificaciones ya leídas, pero respetamos lógica original
        },
      });

      console.log(`Se eliminaron ${result.count} notificaciones antiguas.`);
    } catch (error) {
      console.error("Error durante la limpieza:", error);
    } finally {
      this.isRunning = false;
    }
  }

  async ManualNotificationCleanup() {
    console.log("Ejecutando limpieza manual...");
    await this.NotificationCleanup();
    await this.AbandonedOrdersCleanup();
  }

  stop() {
    if (this.notificationTask) {
      this.notificationTask.stop();
      console.log("Tarea de limpieza de notificaciones detenida.");
    }
    if (this.ordersTask) {
      this.ordersTask.stop();
      console.log("Tarea de limpieza de órdenes detenida.");
    }
  }
}
