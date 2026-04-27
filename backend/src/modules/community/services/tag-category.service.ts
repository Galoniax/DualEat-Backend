import { prisma } from "../../../core/database/prisma/prisma";
import { TagCategory } from "@prisma/client";

export class TagCategoryService {
  // =========================================================
  // OBTENER TODAS LAS CATEGORIAS
  // =========================================================
  async getAllTagCategories(): Promise<TagCategory[]> {
    try {
      const categories = await prisma.tagCategory.findMany();
      return categories;
    } catch (e) {
      throw new Error(`Error al obtener categorias de tags: ${e}`);
    }
  }
}