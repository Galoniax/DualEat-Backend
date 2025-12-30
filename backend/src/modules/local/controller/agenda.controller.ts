import { Request, Response } from "express";
import { CalendarService } from "../service/calendar.service";
import { LocalEventType, EventStatus } from "@prisma/client";

export class AgendaController {
  constructor(private agendaService: CalendarService) {}

  // =========================================================
  // CONTROLADOR DEL CALENDARIO
  // =========================================================

  /** Listar eventos */
  async listEvents(req: Request, res: Response) {
    try {
      const localId = req.params.localId;
      const { start, end } = req.query;

      if (!localId || typeof start !== "string" || typeof end !== "string") {
        return res.status(400).json({ error: "Local y fechas son requeridos" });
      }

      const startDate = new Date(start);
      const endDate = new Date(end);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "fechas no validas" });
      }

      const events = await this.agendaService.getEventsByLocal(
        localId,
        startDate,
        endDate
      );

      return res.status(200).json(events);
    } catch (error: any) {
      console.error("Error fetching calendar events:", error);
      return res
        .status(500)
        .json({ error: error.message || "Internal Server Error" });
    }
  }

  /** Crear eventos */
  async createEvent(req: Request, res: Response) {
    try {
      const data = req.body;

      if (!data.local_id || !data.title || !data.start_time) {
        return res.status(400).json({
          error:
            "Local ID, title, and start_time are required to create an event.",
        });
      }

      const eventData = {
        ...data,
        start_time: new Date(data.start_time),
        end_time: data.end_time ? new Date(data.end_time) : undefined,
        priority: data.priority ? parseInt(data.priority) : undefined,
        event_type: data.event_type as LocalEventType,
        status: data.status as EventStatus,
      };

      const newEvent = await this.agendaService.createEvent(eventData);
      return res.status(201).json(newEvent);
    } catch (error: any) {
      console.error("Error creating event:", error);
      return res
        .status(500)
        .json({ error: error.message || "Internal Server Error" });
    }
  }

  /** Actualizar eventos */
  async updateEvent(req: Request, res: Response) {
    try {
      const eventId = req.params.eventId;
      const dataToUpdate = req.body;

      if (dataToUpdate.start_time)
        dataToUpdate.start_time = new Date(dataToUpdate.start_time);
      if (dataToUpdate.end_time)
        dataToUpdate.end_time = new Date(dataToUpdate.end_time);
      if (dataToUpdate.priority)
        dataToUpdate.priority = parseInt(dataToUpdate.priority);

      const updatedEvent = await this.agendaService.updateEvent(
        eventId,
        dataToUpdate
      );
      return res.status(200).json(updatedEvent);
    } catch (error: any) {
      console.error("Error updating event:", error);
      return res
        .status(500)
        .json({ error: error.message || "Internal Server Error" });
    }
  }

  /** Eliminar eventos */
  async deleteEvent(req: Request, res: Response) {
    try {
      const eventId = req.params.eventId;
      await this.agendaService.deleteEvent(eventId);
      return res
        .status(200)
        .json({ success: true, message: "Event deleted successfully." });
    } catch (error: any) {
      console.error("Error deleting event:", error);
      return res
        .status(500)
        .json({ error: error.message || "Internal Server Error" });
    }
  }

  // =========================================================
  // CONTROLADOR DE NOTAS
  // =========================================================

  /** Listar notas */
  async listNotes(req: Request, res: Response) {
    try {
      const localId = req.params.localId;
      if (!localId) {
        return res.status(400).json({ error: "Local ID is required." });
      }

      const notes = await this.agendaService.getNotesByLocal(localId);
      return res.status(200).json(notes);
    } catch (error: any) {
      console.error("Error fetching notes:", error);
      return res
        .status(500)
        .json({ error: error.message || "Internal Server Error" });
    }
  }

  /** Crear nota */
  async createNote(req: Request, res: Response) {
    try {
      const data = req.body;

      if (!data.local_id || !data.title || !data.content) {
        return res.status(400).json({
          error: "Local ID, title, and content are required to create a note.",
        });
      }

      const noteData = {
        ...data,
        due_date: data.due_date ? new Date(data.due_date) : undefined,
      };

      const newNote = await this.agendaService.createNote(noteData);
      return res.status(201).json(newNote);
    } catch (error: any) {
      console.error("Error creating note:", error);
      return res
        .status(500)
        .json({ error: error.message || "Internal Server Error" });
    }
  }

  /** Actualizar nota */
  async updateNote(req: Request, res: Response) {
    try {
      const noteId = req.params.noteId;
      const dataToUpdate = req.body;

      if (dataToUpdate.due_date)
        dataToUpdate.due_date = new Date(dataToUpdate.due_date);

      const updatedNote = await this.agendaService.updateNote(
        noteId,
        dataToUpdate
      );
      return res.status(200).json(updatedNote);
    } catch (error: any) {
      console.error("Error updating note:", error);
      return res
        .status(500)
        .json({ error: error.message || "Internal Server Error" });
    }
  }

  /** Eliminar nota */
  async deleteNote(req: Request, res: Response) {
    try {
      const noteId = req.params.noteId;
      await this.agendaService.deleteNote(noteId);
      return res
        .status(200)
        .json({ success: true, message: "Nota eliminada correctamente." });
    } catch (error: any) {
      console.error("Error deleting note:", error);
      return res
        .status(500)
        .json({ error: error.message || "Internal Server Error" });
    }
  }
}
