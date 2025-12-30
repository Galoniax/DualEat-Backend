import {
  LocalCalendarEvent,
  LocalNote,
  LocalEventType,
  EventStatus,
} from "@prisma/client";

import { prisma } from "../../../core/database/prisma/prisma";

export class CalendarService {
  constructor() {}

  // =========================================================
  // EVENTOS DEL CALENDARIO
  // =========================================================

  /** Listar eventos por local dentro de un rango de fechas */
  async getEventsByLocal(localId: string, startDate: Date, endDate: Date) {
    return await prisma.localCalendarEvent.findMany({
      where: {
        local_id: localId,
        start_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        start_time: "asc",
      },
    });
  }

  /** Crear un nuevo evento */
  async createEvent(data: {
    local_id: string;
    title: string;
    description?: string;
    start_time: Date;
    end_time?: Date;
    is_full_day?: boolean;
    event_type?: LocalEventType;
    status?: EventStatus;
    priority?: number;
  }): Promise<LocalCalendarEvent> {
    return await prisma.localCalendarEvent.create({ data });
  }

  /** Actualizar un evento existente */
  async updateEvent(
    eventId: string,
    data: Partial<LocalCalendarEvent>
  ): Promise<LocalCalendarEvent> {
    const updatePayload: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) {
        continue;
      }

      if (key === "status" && typeof value === "string") {
        if (Object.values(EventStatus).includes(value as EventStatus)) {
          updatePayload.status = value as EventStatus;
        }
      } else if (key === "priority") {
        updatePayload.priority = Number(value);
      } else {
        updatePayload[key] = value;
      }
    }

    return await prisma.localCalendarEvent.update({
      where: { id: eventId },
      data: updatePayload,
    });
  }

  /** Eliminar un evento existente */
  async deleteEvent(eventId: string) {
    return await prisma.localCalendarEvent.delete({ where: { id: eventId } });
  }

  // =========================================================
  // NOTAS DEL LOCAL
  // =========================================================

  /** Listar notas por local */
  async getNotesByLocal(localId: string) {
    return await prisma.localNote.findMany({
      where: { local_id: localId },
      orderBy: [{ is_pinned: "desc" }, { created_at: "desc" }],
    });
  }
  /** Crear una nueva nota */
  async createNote(data: {
    local_id: string;
    title: string;
    content: string;
    is_pinned?: boolean;
    is_completed?: boolean;
    due_date?: Date;
  }): Promise<LocalNote> {
    return await prisma.localNote.create({ data });
  }

  /** Actualizar una nota existente */
  async updateNote(
    noteId: string,
    data: Partial<LocalNote>
  ): Promise<LocalNote> {
    return await prisma.localNote.update({
      where: { id: noteId },
      data,
    });
  }

  /** Eliminar una nota existente */
  async deleteNote(noteId: string) {
    return await prisma.localNote.delete({ where: { id: noteId } });
  }
}
