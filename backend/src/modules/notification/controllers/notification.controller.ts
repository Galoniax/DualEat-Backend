import { Request, Response } from "express";
import { NotificationService } from "../services/notification.service";

export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  // OBTENER NOTIFICACIONES DE UN USUARIO
  // =========================================================
  async getAll(req: Request, res: Response) {
    const user_id = (req as any).user?.id || req.query.user_id;

    try {
      const result = await this.notificationService.getAll(user_id);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: "No se encontraron notificaciones",
        });
      }

      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error al obtener las notificaciones",
      });
    }
  }

  // CAMBIAR ESTADO DE UNA NOTIFICACIÓN
  // =========================================================
  async changeStatus(req: Request, res: Response) {
    const { community_id, type, value } = req.body;
    const user_id = (req as any).user?.id;
    
    try {
      const notification = await this.notificationService.changeStatus(
        community_id,
        user_id,
        type,
        value,
      );
      return res.status(200).json({ success: true, data: notification });
    } catch (e: any) {
      return res.status(400).json({
        success: false,
        message: e.message || "Error al cambiar el estado de la notificación",
      });
    }
  }

  // MARCAR TODAS LAS NOTIFICACIONES COMO LEÍDAS
  // =========================================================
  async markAllAsRead(req: Request, res: Response) {
    const user_id = (req as any).user?.id;

    try {
      await this.notificationService.markAllasRead(user_id);
      return res.status(200).json({
        success: true,
        message: "Notificaciones marcadas como leídas",
      });
    } catch (e: any) {
      return res.status(400).json({
        success: false,
        message: e.message || "Error al marcar las notificaciones como leídas",
      });
    }
  }

  // MARCAR UNA NOTIFICACIÓN COMO LEÍDA
  // =========================================================
  async markAsRead(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    const user_id = (req as any).user?.id;

    try {
      await this.notificationService.markAsRead(String(id), user_id);
      return res
        .status(200)
        .json({ success: true, message: "Notificación marcada como leída" });
    } catch (e: any) {
      return res.status(400).json({
        success: false,
        message: e.message || "Error al marcar la notificación",
      });
    }
  }

  // ELIMINAR TODAS LAS NOTIFICACIONES
  // =========================================================
  async deleteAll(req: Request, res: Response) {
    try {
      const user_id = (req as any).user?.id;

      await this.notificationService.deleteAll(user_id);
      return res.status(204).send();
    } catch (e: any) {
      return res
        .status(500)
        .json({ message: e.message || "Error al eliminar las notificaciones" });
    }
  }

  // ELIMINAR UNA NOTIFICACIÓN
  // =========================================================
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const user_id = (req as any).user?.id;

      await this.notificationService.delete(String(id), user_id);
      return res.status(204).send();
    } catch (e: any) {
      return res
        .status(500)
        .json({ message: e.message || "Error al eliminar la notificación" });
    }
  }
}
