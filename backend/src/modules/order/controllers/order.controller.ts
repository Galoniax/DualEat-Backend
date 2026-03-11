import { Request, Response } from "express";
import { OrderService } from "../services/order.service";

export class OrderController {
  constructor(private orderService: OrderService) {}

  // =========================================================
  // OBTENER ORDENES DE UN LOCAL
  // =========================================================
  getOrders = async (req: Request, res: Response) => {
    const localId = req.params.id;
    const { status, from, to } = req.query;

    if (typeof localId !== "string" || !localId) {
      return res.status(400).json({ message: "El ID del local no es válido." });
    }
    try {
      const orders = await this.orderService.getOrders(
        localId,
        status as string,
        from as string,
        to as string,
      );

      return res.json(orders);
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };

  // =========================================================
  // OBTENER ORDENES DE UN USUARIO
  // =========================================================
  getUserOrders = async (req: Request, res: Response) => {
    const user_id = (req as any).user?.id;
    const { page } = req.query;

    if (typeof page !== "string" || isNaN(Number(page))) {
      return res.status(400).json({
        success: false,
        message: "El número de página no es válido.",
      });
    }
    try {
      const orders = await this.orderService.getUserOrders(
        user_id,
        Number(page),
      );

      if (!orders) {
        return res.status(404).json({
          success: false,
          message: "No se encontraron órdenes para este usuario.",
        });
      }

      return res.status(200).json({ success: true, ...orders });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };

  // =========================================================
  // OBTENER ORDEN POR ID
  // =========================================================
  getOrderById = async (req: Request, res: Response) => {
    const { id } = req.params;

    if (typeof id !== "string" || !id) {
      return res.status(400).json({ message: "El ID de la orden no es válido." });
    }
    try {
      const order = await this.orderService.getOrderById(String(id));

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "No se encontró la orden.",
        });
      }

      return res.status(200).json({ success: true, data: order });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };

  // getCartIDs

  // Check in

  // Check out

  // Pre-Pay
}
