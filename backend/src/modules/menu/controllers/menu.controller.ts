import { Request, Response } from "express";

import { FoodService } from "../services/food.service";
import { ManualService } from "../services/manual.service";
import { OrderService } from "../services/order.service";
import { processMenuImage, MenuDish } from "../services/ocr.service";

export class MenuController {
  constructor(
    private foodService: FoodService,
    private manualService: ManualService,
    private orderService: OrderService
  ) {}

   getOrders = async (req: Request, res: Response) => {
    try {
      const localId = req.params.id;
      const { status, from, to } = req.query;

      if (typeof localId !== "string" || !localId) {
        return res.status(400).json({ error: "El ID del local no es válido." });
      }

      const orders = await this.orderService.getOrders(localId, status as string, from as string, to as string);

      return res.json(orders);
    } catch (error) {
      console.error("Error al obtener pedidos:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }

  // ============================================
  // FOODS - LIST & GET
  // ============================================

  /** Consulta la base de datos para obtener la lista de platos de un local */
  listFoods = async (req: Request, res: Response) => {
    try {
      const localId = req.params.localId;
      if (typeof localId !== "string" || !localId) {
        return res.status(400).json({ error: "Invalid local ID" });
      }

      const foods = await this.manualService.getFoodsByLocalWithVotes(localId);

      return res.status(200).json(foods);
    } catch (error: any) {
      console.error("Error fetching foods:", error);
      return res.status(500).json({ error: error.message });
    }
  };

  /** Obtiene un plato específico por su ID */
  getFoodById = async (req: Request, res: Response) => {
    const foodId = req.params.foodId;
    const food = await this.foodService.getFoodById(foodId);
    if (!food) return res.status(404).json({ error: "Plato no encontrado" });
    res.json(food);
  };

  // ============================================
  // FOODS - CREATE (Single & Bulk)
  // ============================================

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

  // ============================================
  // FOODS - UPDATE & DELETE
  // ============================================

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
        dataToUpdate
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
        dishesToSave
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
