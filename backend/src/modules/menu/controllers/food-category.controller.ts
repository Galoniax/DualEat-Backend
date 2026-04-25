import { Request, Response } from "express";

import { TypesCategory } from "@prisma/client";
import { FoodCategoryService } from "../services/category.service";

export class FoodCategoryController {
  constructor(private foodCategoryService: FoodCategoryService) {}

  // ===========================
  // FOOD CATEGORIES - LIST, CREATE, UPDATE, DELETE
  // ===========================
  handleGetAllFoodCategories = async (_req: Request, res: Response) => {
    try {
      const categories = await this.foodCategoryService.getAllFoodCategories();

      if (!categories || categories.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "No se encontraron categorías de comida." });
      }
      res.status(200).json({ success: true, data: categories });
    } catch (e) {
      res.status(500).json({ success: false, message: "Error obteniendo categorías." });
    }
  };

  handleCreateFoodCategory = async (req: Request, res: Response) => {
    const { name, tipo, description, icon_url } = req.body;
    if (!name || !tipo) {
      return res
        .status(400)
        .json({ message: "Category name and tipo are required." });
    }
    try {
      const newCategory = await this.foodCategoryService.createFoodCategory(
        name,
        tipo as TypesCategory,
        icon_url,
      );
      res.status(201).json(newCategory);
    } catch (error) {
      res.status(500).json({ message: "Error creating category." });
    }
  };

  handleUpdateFoodCategory = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, tipo, description, icon_url } = req.body;
    if (!name || !tipo) {
      return res
        .status(400)
        .json({ message: "Category name and tipo are required." });
    }
    try {
      const updatedCategory = await this.foodCategoryService.updateFoodCategory(
        Number(id),
        name,
        tipo as TypesCategory,
        icon_url,
      );
      res.status(200).json(updatedCategory);
    } catch (error) {
      res.status(500).json({ message: "Error updating category." });
    }
  };

  handleDeleteFoodCategory = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      await this.foodCategoryService.deleteFoodCategory(Number(id));
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting food category:", error);
      res.status(400).json({ 
        success: false, 
        message: error.message || "Error al eliminar la categoría." 
      });
    }
  };

  // ===========================
  // LOCAL MENU CATEGORIES - LIST, CREATE, DELETE
  // ===========================
  handleGetLocalMenuCategories = async (req: Request, res: Response) => {
    // 1. Obtiene el ID del local de la URL
    const localId = req.params.localId;

    // 2. Valida que el ID sea un número válido
    if (typeof localId !== "string" || !localId) {
      return res
        .status(400)
        .json({ message: "El ID del local debe ser un número válido." });
    }

    try {
      // 3. Llama a la función del servicio para obtener los datos
      const categories =
        await this.foodCategoryService.getLocalMenuCategories(localId);

      // 4. Envía los datos como respuesta
      res.status(200).json(categories);
    } catch (error) {
      console.error("Error al obtener las categorías del local:", error);
      res.status(500).json({
        message: "Error interno del servidor al obtener las categorías.",
      });
    }
  };

  handleCreateLocalMenuCategory = async (req: Request, res: Response) => {
    const { category_id, local_id } = req.body;
    if (!category_id || !local_id) {
      return res
        .status(400)
        .json({ message: "La categoría y el ID del local son obligatorios." });
    }
    try {
      const updatedLocal =
        await this.foodCategoryService.createLocalMenuCategory(Number(category_id), local_id);
      res.status(201).json(updatedLocal);
    } catch (error) {
      console.error("Error al vincular categoría al local:", error);
      res
        .status(500)
        .json({ message: "Error al vincular categoría al local." });
    }
  };

  handleDeleteLocalMenuCategory = async (req: Request, res: Response) => {
    const { localId, id: categoryId } = req.params;

    if (!localId || !categoryId) {
      return res.status(400).json({ message: "Local ID and Category ID are required." });
    }

    try {
      await this.foodCategoryService.deleteLocalMenuCategory(Number(categoryId), localId as string);
      res.status(204).send();
    } catch (error) {
      console.error("Error al desvincular la categoría:", error);
      res.status(500).json({
        message: "Error interno del servidor al desvincular la categoría.",
      });
    }
  };
}
