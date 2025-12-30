import { prisma } from "../../../core/database/prisma/prisma";
import { TagCategory } from "@prisma/client";

export class TagCategoryService {
  /** OBTENER TODAS LAS CATEGORIAS */
  async getAllTagCategories(): Promise<TagCategory[]> {
    try {
      return await prisma.tagCategory.findMany();
    } catch (error) {
      throw new Error(`Error al obtener categorias de tags: ${error}`);
    }
  }
}
