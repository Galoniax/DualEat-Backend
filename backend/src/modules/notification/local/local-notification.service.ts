import { prisma } from "../../../core/database/prisma/prisma";
import { getSocketServer } from "../../../core/config/socket.config";

export class LocalNotificationService {
  /**
   * Notifica a todos los usuarios negocios sobre una nueva Categoría de Comida.
   */
  async sendCategoryNotification(categoryName: string) {
    try {
      // Buscar a todos los usuarios que son negocios
      const businessUsers = await prisma.user.findMany({
        where: {
          is_business: true,
        },
        select: {
          id: true,
        },
      });

      if (businessUsers.length === 0) return;

      const businessUserIds = businessUsers.map((user) => user.id);

      // Guardar notificaciones en la base de datos
      await prisma.notification.createMany({
        data: businessUserIds.map((userId) => ({
          user_id: userId,
          content_type: "LOCAL",
          message: `El administrador ha agregado una nueva categoría: "${categoryName}". Ahora puedes usarla para tu menú.`,
          metadata: {
            title: "¡Nueva Categoría Disponible!",
            type: "new_category",
          },
        })),
      });

      const socketServer = getSocketServer();
      socketServer.to(businessUserIds).emit("new_category_local", {
        type: "new_category",
        title: "¡Nueva Categoría Disponible!",
        message: `El administrador ha agregado una nueva categoría: "${categoryName}". Ahora puedes usarla para tu menú.`,
      });

      console.log(
        `[Socket] Notificación de nueva categoría enviada a ${businessUserIds.length} negocios.`
      );
    } catch (error) {
      console.error(
        "Error al enviar notificación de nueva categoría por Socket.io:",
        error
      );
    }
  }

  /**
   * Notifica a los usuarios asigandos a un local (Dueños/Staff) sobre una nueva reseña.
   */
  async sendReviewNotification(localId: string, rating: number, userName: string) {
    try {
      // Buscar el local para el nombre, y los LocalUser asignados
      const local = await prisma.local.findUnique({
        where: {
          id: localId,
        },
        include: {
          local_users: {
            select: {
              user_id: true,
            },
          },
        },
      });

      if (!local || !local.local_users || local.local_users.length === 0) return;

      const recipientIds = local.local_users.map((lu) => lu.user_id);

      // Guardar notificaciones en la base de datos
      await prisma.notification.createMany({
        data: recipientIds.map((userId) => ({
          user_id: userId,
          content_type: "LOCAL",
          content_id: localId,
          message: `${userName} ha dejado una reseña de ${rating} estrellas en "${local.name}".`,
          metadata: {
            title: "¡Recibiste una nueva reseña!",
            type: "new_review",
            localId: localId,
          },
        })),
      });

      const socketServer = getSocketServer();
      socketServer.to(recipientIds).emit("new_review_local", {
        type: "new_review",
        localId: localId,
        title: "¡Recibiste una nueva reseña!",
        message: `${userName} ha dejado una reseña de ${rating} estrellas en "${local.name}".`,
      });

      console.log(
        `[Socket] Notificación de reseña (Local: ${local.name}) enviada a ${recipientIds.length} usuarios del local.`
      );
    } catch (error) {
      console.error(
        "Error al enviar notificación de reseña por Socket.io:",
        error
      );
    }
  }
}
