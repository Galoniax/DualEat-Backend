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
      res.status(200).json(categories);
    } catch (error) {
      res.status(500).json({ message: "Error fetching categories." });
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
        description,
        icon_url
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
        description,
        icon_url
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
    } catch (error) {
      res.status(500).json({ message: "Error deleting category." });
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
    const { name, local_id } = req.body;
    if (!name || !local_id) {
      return res
        .status(400)
        .json({ message: "El nombre y el ID del local son obligatorios." });
    }
    try {
      const newCategory =
        await this.foodCategoryService.createLocalMenuCategory(name, local_id);
      res.status(201).json(newCategory);
    } catch (error) {
      console.error("Error al crear la categoría de menú de local:", error);
      res
        .status(500)
        .json({ message: "Error al crear la categoría de menú de local." });
    }
  };

  handleDeleteLocalMenuCategory = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      await this.foodCategoryService.deleteLocalMenuCategory(Number(id));
      res.status(204).send();
    } catch (error) {
      console.error("Error al eliminar la categoría:", error);
      res.status(500).json({
        message: "Error interno del servidor al eliminar la categoría.",
      });
    }
  };
}
