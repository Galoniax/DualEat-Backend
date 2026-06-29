import { Request, Response } from "express";
import { OrderService } from "@/modules/order/services/order.service";
import { CartService } from "@/modules/order/services/cart.service";
import { prisma } from "@/core/database/prisma/prisma";
import { NotificationService } from "@/modules/notification/services/notification.service";
import { getSocketServer } from "@/core/config/socket.config";
import { OrderStatus, User } from "@prisma/client";
import console from "console";

const notificationService = new NotificationService();

export class OrderController {
  constructor(
    private orderService: OrderService,
    private cartService: CartService,
  ) {}

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

  // OBTENER ORDENES DE UN USUARIO
  // =========================================================
  getUserOrders = async (req: Request, res: Response) => {
    const user_id = (req as any).user?.id || req.body.user_id;
    const { page, type } = req.query;

    if (typeof page !== "string" || isNaN(Number(page))) {
      return res.status(400).json({
        success: false,
        message: "El número de página no es válido.",
      });
    }
    try {
      const orders = await this.orderService.getUserOrders(
        String(user_id),
        Number(page),
        type as OrderStatus | "REVIEW",
      );

      if (!orders) {
        return res.status(404).json({
          success: false,
          message: "No se encontraron órdenes para este usuario.",
        });
      }

      return res.status(200).json({ success: true, ...orders });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error interno del servidor",
      });
    }
  };

  // OBTENER ORDEN POR ID
  // =========================================================
  getById = async (req: Request, res: Response) => {
    const { id } = req.params;

    if (typeof id !== "string" || !id) {
      return res
        .status(400)
        .json({ message: "El ID de la orden no es válido." });
    }
    try {
      const order = await this.orderService.getById(String(id));

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

  // PRE-PURCHASE
  // =========================================================
  prePurchase = async (req: Request, res: Response) => {
    const { items, local_id, platform } = req.body as {
      items: { food_id: string; quantity: number }[];
      local_id: string;
      platform?: "mobile" | "web";
    };
    const user = ((req as any).user || req.body.user) as User;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "No autorizado. Se requiere un usuario válido.",
      });
    }

    if (!local_id || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Datos del carrito inválidos o vacíos.",
      });
    }

    try {
      const foodIds = items.map((i) => i.food_id);

      // 1. Obtener la información de precios y promociones del carrito
      const cart = await this.cartService.getCartInfo(foodIds, local_id);

      if (!cart || !cart.items || cart.items.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "No se pudieron resolver los productos del carrito o local no válido.",
        });
      }

      // 2. Mapear items con sus precios reales y cantidades del cliente
      const checkoutItems = cart.items.map((item: any) => {
        const clientItem = items.find((i) => i.food_id === item.id);
        return {
          food_id: item.id,
          name: item.name,
          quantity: clientItem ? clientItem.quantity : 1,
          unit_price: item.price,
        };
      });

      // Obtener la url del backend dinámicamente para redirecciones
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.get("host");
      const backendBaseUrl = `${protocol}://${host}`;

      // 3. Crear la orden y la preferencia de Mercado Pago
      const result = await this.orderService.prePurchase(
        local_id,
        user,
        checkoutItems,
        platform,
        backendBaseUrl,
      );

      console.log(result);

      return res.status(200).json({
        success: true,
        result,
        message: "Precompra creada con éxito. Redirigiendo a checkout.",
      });
    } catch (e: any) {
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Error interno en el servidor",
      });
    }
  };

  // CREAR ORDEN MANUAL (STAFF)
  // =========================================================
  createManualOrder = async (req: Request, res: Response) => {
    const { id: localId } = req.params;
    const { items, notes } = req.body;
    const userId = (req as any).user?.id; // Autenticado por isAuthenticated

    if (!localId || typeof localId !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "ID de local inválido." });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "No autorizado. Se requiere un usuario válido.",
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "La orden debe contener al menos un producto.",
      });
    }

    // Validar estructura de items
    for (const item of items) {
      if (
        !item.food_id ||
        typeof item.quantity !== "number" ||
        item.quantity <= 0
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Formato de productos inválido." });
      }
    }

    try {
      const order = await this.orderService.createManualOrder(
        localId,
        userId,
        items,
        notes,
      );

      // Emitir evento por socket a todos los usuarios del local
      try {
        const localUsers = await prisma.localUser.findMany({
          where: { local_id: localId },
          select: { user_id: true },
        });
        const recipientIds = localUsers.map((lu) => lu.user_id);

        if (recipientIds.length > 0) {
          const io = getSocketServer();
          io.to(recipientIds).emit("new_order_local", {
            orderId: order.id,
            localId,
            total: Number(order.total),
            message: `Nuevo pedido creado (Staff). Total: $${Number(order.total).toFixed(2)}`,
          });
        }
      } catch (socketErr) {
        console.error(
          "Error al emitir socket de nueva orden manual:",
          socketErr,
        );
      }

      return res.status(201).json({ success: true, data: order });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message:
          e.message || "Error interno del servidor al crear orden manual.",
      });
    }
  };

  // ACTUALIZAR ESTADO DE ORDEN (STAFF)
  // =========================================================
  updateOrderStatus = async (req: Request, res: Response) => {
    const localId = req.params.id as string;
    const orderId = req.params.orderId as string;
    const { status } = req.body;

    if (!localId || !orderId) {
      return res
        .status(400)
        .json({ success: false, message: "IDs inválidos." });
    }

    const validStatuses = [
      "PENDING",
      "PAID",
      "COMPLETED",
      "CANCELLED",
      "READY",
    ];
    if (!status || !validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Estado inválido." });
    }

    try {
      const order = await this.orderService.updateOrderStatus(
        orderId,
        localId,
        status,
      );

      // Notificar al local si es PAID o COMPLETED (Notificación flotante)
      if (status === "PAID" || status === "COMPLETED") {
        const localUsers = await prisma.localUser.findMany({
          where: { local_id: localId, role: "admin" },
        });

        const io = getSocketServer();
        for (const lu of localUsers) {
          const notification = await notificationService.create({
            user_id: lu.user_id,
            content_type: "ORDER",
            title:
              status === "COMPLETED"
                ? `Nueva Orden Completada`
                : `Nueva Orden Pagada`,
            content_id: orderId,
            message:
              status === "COMPLETED"
                ? `Nueva Orden Completada. Ganancia: $${Number(order.total).toFixed(2)}`
                : `Nueva Orden Pagada. Ganancia: $${Number(order.total).toFixed(2)}`,
            metadata: {
              type: "order_status",
              orderId,
              status,
              total: Number(order.total),
            },
          });
          io.to(lu.user_id).emit("new_notification", notification);
        }
      }

      // Notificar a todos los usuarios del local sobre la actualización de estado para recarga en tiempo real
      try {
        const localUsersAll = await prisma.localUser.findMany({
          where: { local_id: localId },
          select: { user_id: true },
        });
        const recipientIdsAll = localUsersAll.map((lu) => lu.user_id);
        if (recipientIdsAll.length > 0) {
          const io = getSocketServer();
          io.to(recipientIdsAll).emit("order_status_updated", {
            orderId,
            status,
            localId,
          });
        }
      } catch (socketErr) {
        console.error(
          "Error al emitir socket de actualización de estado:",
          socketErr,
        );
      }

      return res.status(200).json({ success: true, data: order });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error al actualizar el estado de la orden.",
      });
    }
  };

  // ACTUALIZAR ITEMS DE ORDEN (EDITAR) (STAFF)
  // =========================================================
  updateOrderItems = async (req: Request, res: Response) => {
    const localId = req.params.id as string;
    const orderId = req.params.orderId as string;
    const { items } = req.body;

    if (!localId || !orderId) {
      return res
        .status(400)
        .json({ success: false, message: "IDs inválidos." });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "La orden debe contener al menos un producto.",
      });
    }

    for (const item of items) {
      if (
        !item.food_id ||
        typeof item.quantity !== "number" ||
        item.quantity <= 0
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Formato de productos inválido." });
      }
    }

    try {
      const order = await this.orderService.updateOrderItems(
        orderId,
        localId,
        items,
      );
      return res.status(200).json({ success: true, data: order });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error al actualizar los items de la orden.",
      });
    }
  };
}
