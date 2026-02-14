import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";

import { SettingsService } from "../service/settings.service";
import { StatisticsService } from "../service/statistics.service";
import { QrService } from "../../../core/services/qr.service";
import { CalendarService } from "../service/calendar.service";
import { DiscoveryService } from "../service/discovery.service";

import { BusinessController } from "../controller/local.controller";
import { AgendaController } from "../controller/agenda.controller";
import { DiscoveryController } from "../controller/discovery.controller";

const router = Router();

const settingsService = new SettingsService();
const statisticsService = new StatisticsService();
const qrService = new QrService();
const agendaService = new CalendarService();
const discoveryService = new DiscoveryService();

const controller = new BusinessController(
  settingsService,
  statisticsService,
  qrService,
);
const agendaController = new AgendaController(agendaService);
const discoveryController = new DiscoveryController(discoveryService);

// --- SUPABASE ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = "menu";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Supabase URL or Service Role Key is not defined in environment variables.",
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

const upload = multer({ storage: multer.memoryStorage() });

// =========================================================
// 1. DESCUBRIMIENTO (Discovery)
// =========================================================

// Obtener locales en mapa por coordenadas y preferencias
router.post("/discovery/bounds", discoveryController.getLocalInBounds);

// Obtener detalle de un local
router.get("/discovery/local/:slug", discoveryController.getLocal);

// Obtener locales por cercanía
router.post("/discovery/nearby", discoveryController.getLocalByNearby);

// Obtener reviews paginadas
router.get("/discovery/local/:slug/reviews", discoveryController.getReviews);

// =========================================================
// 2. CONFIGURACIÓN Y SETTINGS (Business)
// =========================================================

router.get("/settings/:localId", controller.getSettings);
router.put("/settings/:localId", controller.updateSettings);

// Gestión de imágenes con Supabase
router.post(
  "/settings/upload-image/:localId",
  upload.single("image"),
  async (req, res) => {
    const { localId } = req.params;
    if (!req.file)
      return res.status(400).json({ message: "No se ha enviado imagen." });

    try {
      const file = req.file;
      const filePath = `local_images/${localId}/${uuidv4()}-${file.originalname}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);
      res.status(200).json({ url: publicUrlData.publicUrl });
    } catch (err) {
      res.status(500).json({ message: "Error al subir la imagen." });
    }
  },
);

// Horarios
router.get("/settings/:localId/schedule", controller.getSchedules);
router.put("/settings/:localId/schedule", controller.updateSchedules);

// =========================================================
// 3. AGENDA Y CALENDARIO (LocalCalendarEvent & Notes)
// =========================================================

// Eventos
router.get("/agenda/local/:localId/events", agendaController.listEvents);
router.post("/agenda/events", agendaController.createEvent);
router.put("/agenda/events/:eventId", agendaController.updateEvent);
router.delete("/agenda/events/:eventId", agendaController.deleteEvent);

// Notas
router.get("/agenda/local/:localId/notes", agendaController.listNotes);
router.post("/agenda/notes", agendaController.createNote);
router.put("/agenda/notes/:noteId", agendaController.updateNote);
router.delete("/agenda/notes/:noteId", agendaController.deleteNote);

// =========================================================
// 4. ESTADÍSTICAS Y HERRAMIENTAS
// =========================================================

router.get("/statistics/:id/top-foods", controller.getTopFoods);
router.get("/statistics/:id/monthly-earnings", controller.getMonthlyEarnings);

// QR Code
router.get("/tools/qr/:localId", controller.generateQrCodeController);

export default router;
