import { Request, Response } from "express";
import { DiscoveryService } from "../service/discovery.service";

export class DiscoveryController {
  constructor(private discoveryService: DiscoveryService) {}

  // =========================================================
  // OBTENER LOCAL POR MAPA O PREFERENCIAS
  // =========================================================
  getLocalInBounds = async (req: Request, res: Response) => {
    const { minLat, maxLat, minLng, maxLng } = req.body;
    const { preferencesDTO } = req.body;

    //console.log("Received preferencesDTO:", preferencesDTO);
    //console.log("Received bounds:", { minLat, maxLat, minLng, maxLng });

    if (
      minLat === undefined ||
      maxLat === undefined ||
      minLng === undefined ||
      maxLng === undefined
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Faltan parámetros de ubicación" });
    }

    try {
      const locals = await this.discoveryService.getLocalsInBounds(
        Number(minLat),
        Number(maxLat),
        Number(minLng),
        Number(maxLng),
        preferencesDTO,
      );

      if (!locals)
        return res
          .status(404)
          .json({ success: false, message: "No se encontraron locales" });

      return res.json({ success: true, data: locals });
    } catch (error) {
      console.error("Error buscando locales en bounds:", error);
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };

  // =========================================================
  // OBTENER LOCALES POR CERCANÍA
  // =========================================================
  getLocalByNearby = async (req: Request, res: Response) => {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res
        .status(400)
        .json({ success: false, message: "Faltan parámetros de ubicación" });
    }

    try {
      const locals = await this.discoveryService.getLocalsByNearby(
        Number(lat),
        Number(lng),
        1000,
      );

      if (!locals || locals.length === 0) {
        return res
          .status(404)
          .json({
            success: false,
            message: "No se encontraron locales cercanos",
          });
      }

      return res.json({ success: true, data: locals });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };

  // =========================================================
  // OBTENER LOCAL
  // =========================================================
  getLocal = async (req: Request, res: Response) => {
    const { slug } = req.params;

    try {
      const local = await this.discoveryService.getLocal(String(slug));

      if (!local)
        return res
          .status(404)
          .json({ success: false, message: "Local no encontrado" });

      return res.json({ success: true, data: local });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };

  // =========================================================
  // OBTENER REVIEWS DE UN LOCAL
  // =========================================================
  getReviews = async (req: Request, res: Response) => {
    const { slug } = req.params;
    const { page } = req.query;

    try {
      const reviews = await this.discoveryService.getReviews(
        Number(page),
        String(slug),
      );

      if (!reviews)
        return res
          .status(404)
          .json({ success: false, message: "Reviews no encontradas" });

      return res.json({ success: true, ...reviews });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };
}
