import { Request, Response } from "express";
import { SettingsService } from "../service/settings.service";
import { StatisticsService } from "../service/statistics.service";
import { QrService } from "../../../core/services/qr.service";

import { DayOfWeek } from "@prisma/client";

export class LocalController {
  constructor(
    private settingsService: SettingsService,
    private stadisticsService: StatisticsService,
    private qrService: QrService,
  ) {}

  // =========================================================
  // CONFIGURACIÓN Y HORARIOS
  // =========================================================
  getSettings = async (req: Request, res: Response) => {
    try {
      const localId = req.params.localId;

      if (!localId || typeof localId !== "string") {
        return res.status(400).json({ error: "Local ID es invalido" });
      }

      const settings = await this.settingsService.getLocalById(localId);
      if (!settings)
        return res.status(404).json({ error: "Local no encontrado" });
      return res.status(200).json(settings);
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };  

  updateSettings = async (req: Request, res: Response) => {
    try {
      const localId = req.params.localId;

      const data = req.body;

      if (!localId || typeof localId !== "string") {
        return res.status(400).json({ error: "Local ID es invalido" });
      }

      if (!data || typeof data !== "object") {
        return res
          .status(400)
          .json({ error: "Datos de configuración inválidos" });
      }

      const updatedSettings = await this.settingsService.updateLocalById(
        localId,
        data,
      );

      if (!updatedSettings) {
        return res.status(404).json({ error: "Local no encontrado" });
      }

      return res.status(200).json(updatedSettings);
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };

  getSchedules = async (req: Request, res: Response) => {
    const { slug } = req.params;

    if (!slug || typeof slug !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Slug invalido o no proporcionado" });
    }

    try {
      const schedules = await this.settingsService.getLocalSchedules(
        String(slug),
      );

      if (!schedules)
        return res
          .status(404)
          .json({ success: false, message: "Horarios no encontrados" });

      return res.status(200).json({ success: true, data: schedules });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };

  updateSchedules = async (req: Request, res: Response) => {
    try {
      const localId = req.params.localId;
      const schedules = req.body;

      if (!localId || typeof localId !== "string") {
        return res.status(400).json({ error: "Local ID es invalido" });
      }

      if (!Array.isArray(schedules)) {
        return res.status(400).json({
          error:
            "Se esperaba un array de horarios en el cuerpo de la solicitud.",
        });
      }

      const dayOfWeekValues = Object.values(DayOfWeek);
      const isValid = schedules.every(
        (s) =>
          dayOfWeekValues.includes(s.day_of_week) &&
          typeof s.open_time === "string" &&
          typeof s.close_time === "string",
      );

      if (!isValid) {
        return res.status(400).json({
          error:
            "El array de horarios contiene una estructura inválida o valores de day_of_week no válidos.",
          expected_days: dayOfWeekValues,
        });
      }

      // Llamamos al Service para reemplazar los horarios
      const updatedSchedules = await this.settingsService.updateLocalSchedules(
        localId,
        schedules,
      );

      return res.status(200).json({
        message: "Horarios actualizados exitosamente.",
        schedules: updatedSchedules,
      });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    } 
  };

  // =========================================================
  // ESTADÍSTICAS (Dashboard)
  // =========================================================
  getTopFoods = async (req: Request, res: Response) => {
    try {
      const localId = req.params.id;
      const { from, to } = req.query;

      if (typeof localId !== "string" || !localId) {
        return res.status(400).json({ error: "El ID del local no es válido." });
      }

      const top_foods = await this.stadisticsService.getTopFoods(
        localId,
        from as string,
        to as string,
      );

      return res.json({
        top_foods,
      });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };

  getMonthlyEarnings = async (req: Request, res: Response) => {
    try {
      const localId = req.params.id;
      const { from, to } = req.query;

      // Se requieren las fechas de inicio y fin para este cálculo
      if (!from || !to || typeof localId !== "string" || !localId) {
        return res.status(400).json({
          error:
            "Parámetros inválidos. Se requiere el ID del local, 'from' y 'to'.",
        });
      }

      // Llamada al nuevo método del servicio
      const monthlyEarnings =
        await this.stadisticsService.getMonthlyLocalEarnings(
          localId,
          from as string,
          to as string,
        );

      return res.json(monthlyEarnings);
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };

  // =========================================================
  // ACTIVOS (QR)
  // =========================================================
  generateQrCode = async (req: Request, res: Response) => {
    try {
      const localId = req.params.localId;
      if (typeof localId !== "string" || !localId) {
        return res.status(400).json({ error: "ID de local no válido." });
      }

      const qrResponse = await this.qrService.generateQrForLocal(localId);
      res.json(qrResponse);
    } catch (e: any) {
      if (e.message === "Local no encontrado") {
        return res.status(404).json({ error: e.message });
      }
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };
}
