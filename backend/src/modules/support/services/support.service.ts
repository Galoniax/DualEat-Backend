import { prisma } from "../../../core/database/prisma/prisma";
import { TicketType, TicketStatus, SupportSenderRole } from "@prisma/client";

export class SupportService {
  async createTicket(localId: string, type: TicketType) {
    return await prisma.supportTicket.create({
      data: {
        local_id: localId,
        type,
        status: TicketStatus.OPEN,
      },
    });
  }

  async getTicketsForLocal(localId: string) {
    return await prisma.supportTicket.findMany({
      where: { local_id: localId },
      orderBy: { updated_at: "desc" },
      include: {
        _count: {
          select: { messages: { where: { read: false, sender_role: 'ADMIN' } } }
        }
      }
    });
  }

  async getTicketsForAdmins() {
    return await prisma.supportTicket.findMany({
      orderBy: [
        { status: "asc" },
        { updated_at: "desc" }
      ],
      include: {
        local: {
          select: { name: true, image_url: true }
        },
        _count: {
          select: { messages: { where: { read: false, sender_role: 'LOCAL' } } }
        }
      }
    });
  }

  async getTicketMessages(ticketId: string) {
    return await prisma.supportMessage.findMany({
      where: { ticket_id: ticketId },
      orderBy: { created_at: "asc" },
      include: {
        sender: {
          select: { name: true, avatar_url: true }
        }
      }
    });
  }

  async addMessage(ticketId: string, senderId: string, senderRole: SupportSenderRole, content: string) {
    const message = await prisma.supportMessage.create({
      data: {
        ticket_id: ticketId,
        sender_id: senderId,
        sender_role: senderRole,
        content,
      },
      include: {
        sender: {
          select: { name: true, avatar_url: true }
        }
      }
    });

    // Update ticket updated_at
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updated_at: new Date() }
    });

    return message;
  }

  async updateTicketStatus(ticketId: string, status: TicketStatus) {
    return await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status }
    });
  }

  async markMessagesAsRead(ticketId: string, roleToMark: SupportSenderRole) {
    return await prisma.supportMessage.updateMany({
      where: {
        ticket_id: ticketId,
        sender_role: roleToMark, // We mark as read the messages sent BY the other role
        read: false
      },
      data: {
        read: true
      }
    });
  }
}

export const supportService = new SupportService();
