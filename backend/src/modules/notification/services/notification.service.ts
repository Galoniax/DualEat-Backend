import { prisma } from "@/core/database/prisma/prisma";
import type { CreateNotificationDTO } from "../types/notification.dto";

export class NotificationService {
  constructor() {}

  // OBTENER NOTIFICACIONES
  // =========================================================
  async getAll(user_id: string) {
    try {
      const result = await prisma.notification.findMany({
        where: {
          user_id,
        },
        include: {
          user: {
            select: {
              id: true,
              slug: true,
              name: true,
              avatar_url: true,
            },
          },
        },
        orderBy: {
          created_at: "desc",
        },
      });

      return result;
    } catch (e) {
      throw new Error(`Error al obtener notificaciones: ${e}`);
    }
  }

  // CAMBIAR ESTADO DE UNA NOTIFICACIÓN
  // =========================================================
  async changeStatus(
    community_id: string,
    user_id: string,
    type: string,
    value: "ALWAYS" | "NONE",
  ) {
    try {
      if (type === "member") {
        const result = await prisma.communityMember.update({
          where: {
            user_id_community_id: {
              user_id: user_id,
              community_id: community_id,
            },
          },
          data: {
            receives_notifications: value,
          },
        });
        return result;
      }

      if (type === "user") {
        const result = await prisma.user.update({
          where: {
            id: user_id,
          },
          data: {
            notificationsPref: value,
          },
        });
        return result;
      }
    } catch (error) {
      throw new Error(`Error al cambiar las preferencias: ${error}`);
    }
  }

  // MARCAR TODAS NOTIFICACIONES COMO LEÍDAS
  // =========================================================
  async markAllasRead(user_id: string) {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          user_id,
        },
        data: {
          read: true,
        },
      });
      return result;
    } catch (error) {
      throw new Error(`Error al obtener notificaciones: ${error}`);
    }
  }

  // MARCAR UNA NOTIFICACIÓN COMO LEÍDA
  // =========================================================
  async markAsRead(id: string, user_id: string) {
    try {
      const notif = await prisma.notification.findFirst({
        where: {
          id,
          user_id,
        },
      });

      if (!notif) {
        throw new Error("Notificación no encontrada o no pertenece al usuario");
      }
      const result = await prisma.notification.update({
        where: {
          id,
          user_id,
        },
        data: {
          read: true,
        },
      });
      return result;
    } catch (e: any) {
      throw e;
    }
  }

  // ELIMINAR TODAS LAS NOTIFICACIONES
  // =========================================================
  async deleteAll(user_id: string) {
    try {
      const result = await prisma.notification.deleteMany({
        where: {
          user_id,
        },
      });
      return result;
    } catch (e: any) {
      throw new Error(`Error al eliminar todas las notificaciones`);
    }
  }

  // ELIMINAR UNA NOTIFICACIÓN
  // =========================================================
  async delete(id: string, user_id: string) {
    try {
      const result = await prisma.notification.delete({
        where: {
          id,
          user_id,
        },
      });
      return result;
    } catch (e: any) {
      throw new Error(`Error al eliminar la notificación`);
    }
  }

  // CREAR NOTIFICACIÓN
  // =========================================================
  async create(data: CreateNotificationDTO) {
    try {
      const notification = await prisma.notification.create({
        data: {
          user_id: data.user_id,
          content_type: data.content_type,
          title: data.title,
          content_id: data.content_id,

          message: data.message,
          metadata: data.metadata || {},
        },
      });

      return notification;
    } catch (e: any) {
      throw null;
    }
  }

  // CREAR MUCHAS NOTIFICACIONES
  // =========================================================
  async createMany(notifications: CreateNotificationDTO[]) {
    try {
      const result = await prisma.notification.createMany({
        data: notifications.map((notif) => ({
          user_id: notif.user_id,
          title: notif.title,
          content_type: notif.content_type,
          content_id: notif.content_id,
          message: notif.message,
          metadata: notif.metadata || {},
        })),
      });

      return result;
    } catch (e: any) {
      return null;
    }
  }
}
