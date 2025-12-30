import { Request, Response } from "express";
import { SettingsService } from "../service/settings.service";
import { StatisticsService } from "../service/statistics.service";
import { QrService } from "../../../shared/services/qr.service";

import { DayOfWeek } from "@prisma/client";

export class BusinessController {
  constructor(
    private settingsService: SettingsService,
    private stadisticsService: StatisticsService,
    private qrService: QrService
  ) {}

  // =========================================================
  // ⚙️ CONFIGURACIÓN Y HORARIOS
  // =========================================================

  getSettings = async (req: Request, res: Response) => {
    try {
      const localId = req.params.localId;

      if (!localId || typeof localId !== "string") {
        return res.status(400).json({ error: "Local ID es invalido" });
      }

      const settings = await this.settingsService.getLocalSettings(localId);
      if (!settings)
        return res.status(404).json({ error: "Local no encontrado" });
      return res.status(200).json(settings);
    } catch (error: any) {
      console.error("Error obteniendo la configuración del local:", error);

      return res
        .status(500)
        .json({ error: error.message || "Error interno del servidor" });
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
        data
      );

      if (!updatedSettings) {
        return res.status(404).json({ error: "Local no encontrado" });
      }

      return res.status(200).json(updatedSettings);
    } catch (error: any) {}
  };

  getSchedules = async (req: Request, res: Response) => {
    try {
      const localId = req.params.localId;

      if (!localId || typeof localId !== "string") {
        return res.status(400).json({ error: "Local ID es invalido" });
      }

      const schedules = await this.settingsService.getLocalSchedules(localId);
      if (!schedules)
        return res.status(404).json({ error: "Local no encontrado" });
      return res.status(200).json(schedules);
    } catch (error: any) {
      console.error("Error obteniendo los horarios del local:", error);

      return res
        .status(500)
        .json({ error: error.message || "Error interno del servidor" });
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
          typeof s.close_time === "string"
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
        schedules
      );

      return res.status(200).json({
        message: "Horarios actualizados exitosamente.",
        schedules: updatedSchedules,
      });
    } catch (error: any) {
      console.error("Error actualizando los horarios del local:", error);

      return res
        .status(500)
        .json({ error: error.message || "Error interno del servidor" });
    }
  };

  // =========================================================
  // 📈 ESTADÍSTICAS (Dashboard)
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
        to as string
      );

      return res.json({
        top_foods,
      });
    } catch (error) {
      console.error("Error al obtener estadísticas:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  };

  // Nuevo método para manejar las ganancias mensuales
  getMonthlyEarnings = async (req: Request, res: Response) => {
    try {
      const localId = req.params.id;
      const { from, to } = req.query;

      // Se requieren las fechas de inicio y fin para este cálculo
      if (!from || !to || typeof localId !== "string" || !localId) {
        return res
          .status(400)
          .json({
            error:
              "Parámetros inválidos. Se requiere el ID del local, 'from' y 'to'.",
          });
      }

      // Llamada al nuevo método del servicio
      const monthlyEarnings =
        await this.stadisticsService.getMonthlyLocalEarnings(
          localId,
          from as string,
          to as string
        );

      return res.json(monthlyEarnings);
    } catch (error) {
      console.error("Error al obtener ganancias mensuales:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  };

  // =========================================================
  // 🔳 ACTIVOS (QR) 
  // =========================================================
  generateQrCodeController = async (req: Request, res: Response) => {
    try {
      const localId = req.params.localId;
      if (typeof localId !== "string" || !localId) {
        return res.status(400).json({ error: "ID de local no válido." });
      }

      const qrResponse = await this.qrService.generateQrForLocal(localId);
      res.json(qrResponse);
    } catch (error: any) {
      if (error.message === "Local no encontrado") {
        return res.status(404).json({ error: error.message });
      }
      res
        .status(500)
        .json({ error: "Error interno del servidor al generar el código QR." });
    }
  };
}
