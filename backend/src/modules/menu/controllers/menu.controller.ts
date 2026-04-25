import { Request, Response } from "express";

import { FoodService } from "../services/food.service";
import { ManualService } from "../services/manual.service";
import { processMenuImage, MenuDish } from "../services/ocr.service";

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export class MenuController {
  constructor(
    private foodService: FoodService,
    private manualService: ManualService,
  ) {}

  // ============================================
  // FOODS - LIST & GET
  // ============================================
  getFoods = async (req: Request, res: Response) => {
    try {
      const { localId } = req.params;

      if (typeof localId !== "string" || !localId) {
        return res
          .status(400)
          .json({ success: false, message: "Local inválido" });
      }

      const foods = await this.foodService.getFoodsByLocalId(localId);

      if (!foods) {
        return res
          .status(404)
          .json({ success: false, message: "Local no encontrado" });
      }

      return res.status(200).json({ success: true, data: foods });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };

  /** Obtiene un plato específico por su ID */
  getFoodById = async (req: Request, res: Response) => {
    const foodId = req.params.foodId as string;
    const food = await this.foodService.getFoodById(foodId);
    if (!food) return res.status(404).json({ error: "Plato no encontrado" });
    res.json(food);
  };

  getFoodsByIds = async (req: Request, res: Response) => {
    const { food_ids } = req.body;

    try {
      if (!food_ids || !Array.isArray(food_ids) || food_ids.length == 0) {
        return res.status(400).json({
          success: false,
          message: "No se proporcionaron IDs de platos",
        });
      }

      const foods = await this.foodService.getFoodsByIds(food_ids);

      res.json({ success: true, data: foods });
    } catch (e) {
      res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };

  /** Crea un plato individual manualmente */
  createFood = async (req: Request, res: Response) => {
    try {
      const localId = req.params.localId;
      if (typeof localId !== "string" || !localId) {
        return res.status(400).json({ error: "Invalid localId" });
      }

      const {
        category_id,
        local_menu_category_id,
        name,
        description,
        price,
        image_url,
        available,
      } = req.body;

      if (!name || price === undefined) {
        return res.status(400).json({ error: "Name and price are required" });
      }

      // Prisma solo acepta category_id. Si el frontend manda local_menu_category_id, lo usamos como category_id
      const finalCategoryId = Number(local_menu_category_id || category_id || 1); // 1 como fallback por seguridad

      const food = await this.manualService.createFood(localId, {
        category_id: finalCategoryId,
        name,
        description,
        price: Number(price),
        image_url,
        available,
      });

      return res.status(201).json(food);
    } catch (error: any) {
      console.error("Error creating food:", error);
      return res.status(500).json({ error: error.message });
    }
  };

  /** Crea múltiples platos en bulk */
 createFoodsBulk = async (req: Request, res: Response) => {
    try {
      const localId = req.params.localId;
      if (typeof localId !== "string" || !localId) {
        return res.status(400).json({ error: "Invalid localId" });
      }

      const { dishes } = req.body;

      if (!dishes || !Array.isArray(dishes) || dishes.length === 0) {
        return res.status(400).json({ error: "Dishes array is required" });
      }

      // EL FIX ESTÁ AQUÍ: Mapeamos los platos extraídos por OCR y forzamos los tipos correctos
      const formattedDishes = dishes.map((dish: any) => ({
        ...dish,
        // Convertimos el precio de String a Number. Si el OCR falló y leyó letras, guardamos 0
        price: Number(dish.price) || 0, 
        // Nos aseguramos de que el category_id también sea un número si es que viene
        category_id: dish.category_id ? Number(dish.category_id) : undefined
      }));

      const foods = await this.manualService.createFoodsBulk(localId, formattedDishes);

      return res.status(201).json({ data: foods });
    } catch (error: any) {
      console.error("Error en bulk create:", error);
      return res.status(500).json({ error: error.message });
    }
  };

  /** Actualiza un plato por su ID */
  updateFood = async (req: Request, res: Response) => {
    try {
      const foodId = req.params.foodId;
      const dataToUpdate = req.body;

      const finalCategoryId = dataToUpdate.local_menu_category_id || dataToUpdate.category_id;

      const updatedFood = await this.manualService.updateFood(
        String(foodId),
        {
          name: dataToUpdate.name,
          description: dataToUpdate.description,
          price: dataToUpdate.price ? Number(dataToUpdate.price) : undefined,
          image_url: dataToUpdate.image_url,
          available: dataToUpdate.available,
          category_id: finalCategoryId ? Number(finalCategoryId) : undefined,
        }
      );
      return res.json(updatedFood);
    } catch (error) {
      console.error("Error al actualizar el plato:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  };

  updateFoodManual = async (req: Request, res: Response) => {
    try {
      const foodId = req.params.id;
      if (typeof foodId !== "string" || !foodId) {
        return res.status(400).json({ error: "Invalid food ID" });
      }

      const {
        category_id,
        local_menu_category_id,
        name,
        description,
        price,
        image_url,
        available,
      } = req.body;

      const finalCategoryId = local_menu_category_id || category_id;

      const food = await this.manualService.updateFood(foodId, {
        category_id: finalCategoryId ? Number(finalCategoryId) : undefined,
        name,
        description,
        price: price !== undefined ? Number(price) : undefined,
        image_url,
        available,
      });

      return res.status(200).json(food);
    } catch (error: any) {
      console.error("Error update manual:", error);
      return res.status(500).json({ error: error.message });
    }
  };

  /** Elimina un plato por su ID */
  deleteFood = async (req: Request, res: Response) => {
    const foodId = req.params.foodId as string;
    await this.foodService.deleteFood(foodId);
    res.json({ success: true });
  };

  // ============================================
  // OCR MENU UPLOAD
  // ============================================

  uploadMenu = async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No se subió ninguna imagen." });
      }

      // 1. Crear una ruta temporal segura en el sistema operativo
      const tempFilePath = path.join(os.tmpdir(), `${Date.now()}-${req.file.originalname}`);
      
      // 2. Escribir el buffer de Multer (RAM) al disco duro temporal
      await fs.writeFile(tempFilePath, req.file.buffer);

      try {
        // 3. Procesar la imagen pasándole la ruta real
        const result = await processMenuImage(tempFilePath);
        const validDishes = result.dishes;

        if (validDishes.length === 0) {
          return res
            .status(422)
            .json({ error: "No se pudieron extraer platos válidos." });
        }

        res.status(200).json({
          success: true,
          message: "Imagen procesada con éxito. Por favor, revise los platos extraídos.",
          dishes: validDishes,
        });

      } finally {
        // 4. Borrar el archivo temporal, ignorando si ya fue borrado por el OCR (ENOENT)
        await fs.unlink(tempFilePath).catch(err => {
          if (err.code !== 'ENOENT') {
            console.error("Error borrando archivo temporal:", err);
          }
        });
      }

    } catch (error) {
      console.error("Error en uploadMenuController:", error);
      res.status(500).json({ error: "Error interno al procesar el menú." });
    }
  };

  bulkSaveFoods = async (req: Request, res: Response) => {
    try {
      const localId = req.params.localId as string;
      const dishesToSave: MenuDish[] = req.body.dishes;

      if (!Array.isArray(dishesToSave) || dishesToSave.length === 0) {
        return res.status(400).json({
          error:
            "El cuerpo de la solicitud debe ser un array de platos no vacío.",
        });
      }

      const savedFoods = await this.foodService.createFoodsFromOcr(
        localId,
        dishesToSave,
      );

      res.status(200).json({
        success: true,
        data: savedFoods,
      });
    } catch (error) {
      console.error("Error en bulkSaveFoodsController:", error);
      res.status(500).json({ error: "Error al guardar los platos extraídos." });
    }
  };
}