import { Request, Response } from "express";

import { FoodService } from "../services/food.service";
import { ManualService } from "../services/manual.service";
import { processMenuImage, MenuDish } from "../services/ocr.service";

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

      const foods = await this.foodService.getLocalWithMenu({ id: localId });

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
    const foodId = req.params.foodId;
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
        discount,
        image_url,
        available,
      } = req.body;

      if (!name || !price) {
        return res.status(400).json({ error: "Name and price are required" });
      }

      const food = await this.manualService.createFood(localId, {
        category_id,
        local_menu_category_id,
        name,
        description,
        price,
        discount,
        image_url,
        available,
      });

      return res.status(201).json(food);
    } catch (error: any) {
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

      const foods = await this.manualService.createFoodsBulk(localId, dishes);

      return res.status(201).json({ data: foods });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  };

  /** Actualiza un plato por su ID */
  updateFood = async (req: Request, res: Response) => {
    try {
      const foodId = req.params.foodId;
      const dataToUpdate = req.body;

      // Convertir el category_id a número si existe
      if (dataToUpdate.category_id) {
        dataToUpdate.category_id = parseInt(dataToUpdate.category_id);
      }

      // Convertir el price a número si existe
      if (dataToUpdate.price) {
        dataToUpdate.price = parseFloat(dataToUpdate.price);
      }

      console.log("Datos recibidos después de parsear:", dataToUpdate);

      const updatedFood = await this.manualService.updateFood(
        String(foodId),
        dataToUpdate,
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
        discount,
        image_url,
        available,
      } = req.body;

      const food = await this.manualService.updateFood(foodId, {
        category_id,
        local_menu_category_id,
        name,
        description,
        price,
        discount,
        image_url,
        available,
      });

      return res.status(200).json(food);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  };

  /** Elimina un plato por su ID */
  deleteFood = async (req: Request, res: Response) => {
    const foodId = req.params.foodId;
    await this.foodService.deleteFood(foodId);
    res.json({ success: true });
  };

  // ============================================
  // OCR MENU UPLOAD
  // ============================================

  /** Procesa imagen de menú y extrae platos con OCR */
  uploadMenu = async (req: Request, res: Response) => {
    try {
      const localId = req.params.localId;
      if (!req.file) {
        return res.status(400).json({ error: "No se subió ninguna imagen." });
      }

      const result = await processMenuImage(req.file.path);
      const validDishes = result.dishes;

      if (validDishes.length === 0) {
        return res
          .status(422)
          .json({ error: "No se pudieron extraer platos válidos." });
      }

      res.status(200).json({
        success: true,
        message:
          "Imagen procesada con éxito. Por favor, revise los platos extraídos.",
        dishes: validDishes,
      });
    } catch (error) {
      console.error("Error en uploadMenuController:", error);
      res.status(500).json({ error: "Error interno." });
    }
  };

  /** Guarda los platos extraídos por OCR en la base de datos */
  bulkSaveFoods = async (req: Request, res: Response) => {
    try {
      const localId = req.params.localId;
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
