import { Router } from "express";

import { createClient } from "@supabase/supabase-js"; 
import multer from "multer"; 
import { v4 as uuidv4 } from "uuid";

import { SettingsService } from "../service/settings.service";
import { StatisticsService } from "../service/statistics.service";
import { QrService } from "../../../shared/services/qr.service";
import { CalendarService } from "../service/calendar.service";

import { BusinessController } from "../controller/local.controller";
import { AgendaController } from "../controller/agenda.controller";

const router = Router();

const settingsService = new SettingsService();
const statisticsService = new StatisticsService();
const qrService = new QrService();
const agendaService = new CalendarService();

const controller = new BusinessController(
  settingsService,
  statisticsService,
  qrService
);

const agendaController = new AgendaController(agendaService);


// --- CONFIGURACIÓN DE SUPABASE Y MULTER ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = "menu"; 

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Supabase URL or Service Role Key is not defined in environment variables."
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

// Configuración de multer para la memoria
const upload = multer({ storage: multer.memoryStorage() });
// ------------------------------------------




// RUTAS DE SETTINGS DEL LOCAL
router.post(
  "/upload-local-image/:localId",
  upload.single("image"),
  async (req, res) => {
    const localId = req.params.localId;
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "No se ha enviado ningún archivo de imagen." });
    }
    if (!localId) {
      return res
        .status(400)
        .json({ message: "Local ID no proporcionado en la ruta." });
    }

    try {
      const file = req.file;
      const filePath = `local_images/${localId}/${uuidv4()}-${file.originalname}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        console.error("Error al subir a Supabase:", uploadError);
        return res
          .status(500)
          .json({ message: "Error al subir la imagen a Supabase." });
      }

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      res.status(200).json({ url: publicUrlData.publicUrl });
    } catch (err) {
      console.error("Error del servidor:", err);
      res.status(500).json({ message: "Error interno del servidor." });
    }
  }
);


// --- RUTAS DE CONFIGURACIÓN GENERAL DEL LOCAL ---
router.get("/:localId", controller.getSettings);

router.put("/:localId", controller.updateSettings);

router.get("/:localId/schedule", controller.getSchedules);

router.put("/:localId/schedule", controller.updateSchedules);


// RUTAS DE CALENDARIO (LocalCalendarEvent)
// Obtener todos los eventos de un local en un rango de fechas
router.get('/local/:localId/events', agendaController.listEvents);

// Crear un nuevo evento de calendario
router.post('/events', agendaController.createEvent);

// Actualizar un evento de calendario
router.put('/events/:eventId', agendaController.updateEvent);

// Eliminar un evento de calendario
router.delete('/events/:eventId', agendaController.deleteEvent);


// RUTAS DE NOTAS/AGENDA (LocalNote)
// Obtener todas las notas de un local
router.get('/local/:localId/notes', agendaController.listNotes);

// Crear una nueva nota
router.post('/notes', agendaController.createNote);

// Actualizar una nota (marcar como completada, cambiar título, etc.)
router.put('/notes/:noteId', agendaController.updateNote);

// Eliminar una nota
router.delete('/notes/:noteId', agendaController.deleteNote);


/** ESTADISTICAS */
// GET platos más vendidos de un local
router.get("/locals/:id/statistics/top-foods", controller.getTopFoods);

// GET ganancias mensuales de un local
router.get('/locals/:id/statistics/monthly-earnings', controller.getMonthlyEarnings);

/** QR */
router.get('/qr/:localId', controller.generateQrCodeController);

export default router;