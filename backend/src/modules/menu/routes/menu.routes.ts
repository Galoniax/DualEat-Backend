import { Router } from "express";
import { MenuController } from "../controllers/menu.controller";
import { createClient } from "@supabase/supabase-js";

import { FoodService } from "../services/food.service";
import { ManualService } from "../services/manual.service";
import { OrderService } from "../services/order.service";

import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { generalLimiter } from "../../../core/middlewares/rateLimiter";

const router = Router();

const foodService = new FoodService();
const manualService = new ManualService();
const orderService = new OrderService();

const controller = new MenuController(foodService, manualService, orderService);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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

// Endpoint para subir la imagen a Supabase
router.post("/upload-image", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ message: "No se ha enviado ningún archivo de imagen." });
  }

  try {
    const file = req.file;
    const filePath = `food_images/${uuidv4()}-${file.originalname}`;

    // Subir la imagen al bucket 'menu'
    const { error: uploadError } = await supabase.storage
      .from("menu")
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error("Error al subir a Supabase:", uploadError);
      return res.status(500).json({ message: "Error al subir la imagen." });
    }

    const { data: publicUrlData } = supabase.storage
      .from("menu")
      .getPublicUrl(filePath);

    res.status(200).json({ url: publicUrlData.publicUrl });
  } catch (err) {
    console.error("Error del servidor:", err);
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

// Obtener ordenes de un local
router.get("/locals/:id/orders", controller.getOrders);

// Listar todos los platos de un local
router.get("/local/:localId/foods", controller.listFoods);

// Obtener un plato puntual
router.get("/foods/:foodId", controller.getFoodById);

// Actualizar un plato (nombre, precio, desc, imagen, available)
router.put("/foods/:foodId", controller.updateFood);

// Eliminar un plato
router.delete("/foods/:foodId", controller.deleteFood);

router.post("/locals/:localId/manual-menu", controller.createFood);

// Crear múltiples comidas en un local (bulk)
router.post("/locals/:localId/manual-menu/bulk", controller.createFoodsBulk);

// Actualizar comida
router.put("/foods/:id", controller.updateFoodManual);

router.post(
  "/local/:localId/menu-upload",
  generalLimiter,
  upload.single("menuImage"),
  controller.uploadMenu
);

router.post("/locals/:localId/manual-menu/bulk", controller.bulkSaveFoods);

export default router;
