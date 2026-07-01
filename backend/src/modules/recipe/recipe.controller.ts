import { Request, Response } from "express";
import { RecipeService } from "./recipe.service";

export class RecipeController {
  constructor(private recipeService: RecipeService) {}

  // OBTENER INGREDIENTES
  // =========================================================
  getAllIngredients = async (req: Request, res: Response) => {
    try {
      const ingredients = await this.recipeService.getAllIngredients();

      if (!ingredients) {
        return res
          .status(404)
          .json({ success: false, message: "No se encontraron ingredientes" });
      }

      return res.status(200).json({ success: true, data: ingredients });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error interno del servidor",
      });
    }
  };

  // OBTENER RECETA POR ID
  // =========================================================
  getById = async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Id no encontrado" });
    }

    try {
      const recipe = await this.recipeService.getById(id);
      if (!recipe) {
        return res
          .status(404)
          .json({ success: false, message: "Receta no encontrada" });
      }
      return res.status(200).json({ success: true, data: recipe });
    } catch (e: any) {
      return res
        .status(e.status || 500)
        .json({ success: false, message: e.message || "Error interno del servidor" });
    }
  };

  // OBTENER RECETAS DEL USUARIO
  // =========================================================
  getUserRecipes = async (req: Request, res: Response) => {
    const user_id = (req as any).user?.id;
    try {
      const recipes = await this.recipeService.getUserRecipes(user_id);
      return res.status(200).json({ success: true, data: recipes });
    } catch (e: any) {
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Error interno del servidor",
      });
    }
  };

  // BUSCAR RECETAS POR NOMBRE (PAGINATION)
  // =========================================================
  searchRecipes = async (req: Request, res: Response) => {
    const { page, query } = req.query;

    if (typeof page !== "string" || isNaN(Number(page))) {
      return res.status(400).json({
        success: false,
        message: "El número de página no es válido.",
      });
    }

    try {
      const recipes = await this.recipeService.searchRecipes(
        String(query),
        null,
        Number(page),
      );
      if (!recipes) {
        return res
          .status(404)
          .json({ success: false, message: "Recetas no encontradas" });
      }
      return res.status(200).json({ success: true, data: recipes });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };
}