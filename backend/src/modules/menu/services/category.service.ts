import { TypesCategory } from "@prisma/client";
import { prisma } from "../../../core/database/prisma/prisma";

export class FoodCategoryService {
  // Obtener todas las categorías de comida asociadas a un local específico
  async getLocalMenuCategories(localId: string) {
    return prisma.localMenuCategory.findMany({
      where: { local_id: localId },
      orderBy: { name: "asc" },
    });
  }

  // Obtener todas las categorías de comida
  async getAllFoodCategories() {
    return prisma.foodCategory.findMany();
  }

  // Crear una nueva categoría de comida
  async createFoodCategory(
    name: string,
    tipo: TypesCategory,
    description: string | null,
    icon_url: string | null
  ) {
    return prisma.foodCategory.create({
      data: { name, tipo, description, icon_url },
    });
  }

  // Actualizar una categoría existente
  async updateFoodCategory(
    id: number,
    name: string,
    tipo: TypesCategory,
    description: string | null,
    icon_url: string | null
  ) {
    return prisma.foodCategory.update({
      where: { id },
      data: { name, tipo, description, icon_url },
    });
  }

  // Eliminar una categoría
  async deleteFoodCategory(id: number) {
    return prisma.foodCategory.delete({
      where: { id },
    });
  }

  async createLocalMenuCategory(name: string, localId: string) {
    return prisma.localMenuCategory.create({
      data: {
        name,
        local_id: localId,
      },
    });
  }

  async deleteLocalMenuCategory(id: number) {
    await prisma.food.updateMany({
      where: { local_menu_category_id: id },
      data: { local_menu_category_id: null },
    });

    return prisma.localMenuCategory.delete({
      where: { id },
    });
  }
}
