import { Request, Response } from "express";
import { supportService } from "../services/support.service";
import { getSocketServer } from "../../../core/config/socket.config";
import { SupportSenderRole, TicketStatus } from "@prisma/client";
import { prisma } from "../../../core/database/prisma/prisma";
import { NotificationService } from "../../notification/services/notification.service";

const notificationService = new NotificationService();

export const createTicket = async (req: Request, res: Response) => {
  try {
    const { localId, type } = req.body;
    if (!localId || !type) {
      return res.status(400).json({ success: false, message: "Missing localId or type" });
    }

    const ticket = await supportService.createTicket(localId, type);
    
    // Notify admins about new ticket
    const io = getSocketServer();
    io.emit("admin_new_ticket", ticket);

    return res.status(201).json({ success: true, ticket });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Error creating ticket" });
  }
};

export const getLocalTickets = async (req: Request, res: Response) => {
  try {
    const localId = req.params.localId as string;
    const tickets = await supportService.getTicketsForLocal(localId);
    return res.status(200).json({ success: true, tickets });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Error fetching tickets" });
  }
};

export const getAdminTickets = async (req: Request, res: Response) => {
  try {
    const tickets = await supportService.getTicketsForAdmins();
    return res.status(200).json({ success: true, tickets });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Error fetching admin tickets" });
  }
};

export const getTicketMessages = async (req: Request, res: Response) => {
  try {
    const ticketId = req.params.ticketId as string;
    const messages = await supportService.getTicketMessages(ticketId);
    return res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Error fetching messages" });
  }
};

export const addMessage = async (req: Request, res: Response) => {
  try {
    const ticketId = req.params.ticketId as string;
    const { senderId, senderRole, content } = req.body;

    if (!senderId || !senderRole || !content) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const message = await supportService.addMessage(ticketId, senderId, senderRole, content);

    // Si el remitente es ADMIN, notificamos al local
    if (senderRole === "ADMIN") {
      const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
      if (ticket) {
        // Encontrar los usuarios administradores del local
        const localUsers = await prisma.localUser.findMany({
          where: { local_id: ticket.local_id, role: "admin" },
        });

        const io = getSocketServer();
        for (const lu of localUsers) {
          const notification = await notificationService.createNotification({
            user_id: lu.user_id,
            content_type: "LOCAL",
            content_id: ticketId,
            message: "Has recibido una respuesta del Soporte de DualEat",
            metadata: { type: "support_reply", ticketId },
          });
          io.to(lu.user_id).emit("new_notification", notification);
        }
      }
    }

    // Emit to ticket room
    const io = getSocketServer();
    io.to(`ticket_${ticketId}`).emit("new_support_message", message);

    return res.status(201).json({ success: true, message });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Error adding message" });
  }
};

export const updateTicketStatus = async (req: Request, res: Response) => {
  try {
    const ticketId = req.params.ticketId as string;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: "Missing status" });
    }

    const ticket = await supportService.updateTicketStatus(ticketId, status as TicketStatus);
    
    // Emit to ticket room and admins
    const io = getSocketServer();
    io.to(`ticket_${ticketId}`).emit("ticket_status_updated", ticket);
    io.emit("admin_ticket_updated", ticket);

    return res.status(200).json({ success: true, ticket });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Error updating ticket status" });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const ticketId = req.params.ticketId as string;
    const { roleToMark } = req.body; // 'ADMIN' if local is reading, 'LOCAL' if admin is reading
    
    if (!roleToMark) {
        return res.status(400).json({ success: false, message: "Missing roleToMark" });
    }

    await supportService.markMessagesAsRead(ticketId, roleToMark as SupportSenderRole);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Error marking messages as read" });
  }
};
