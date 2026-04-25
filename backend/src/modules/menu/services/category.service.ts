import { TypesCategory } from "@prisma/client";
import { prisma } from "../../../core/database/prisma/prisma";
import { LocalNotificationService } from "../../notification/local/local-notification.service";

export class FoodCategoryService {

  // Obtener todas las categorías de comida asociadas a un local específico
  async getLocalMenuCategories(localId: string) {
    return prisma.foodCategory.findMany({
      where: { locals: { some: { id: localId } } },
      orderBy: { name: "asc" },
    });
  }

  // Obtener todas las categorías de comida
  async getAllFoodCategories() {
    const categories = await prisma.foodCategory.findMany({
      orderBy: [{ tipo: "asc" }, { name: "asc" }],
    });

    if (!categories || categories.length === 0) {
      throw new Error("No se encontraron categorías de comida.");
    }

    return categories;
  }

  // Crear una nueva categoría de comida
  async createFoodCategory(
    name: string,
    tipo: TypesCategory,
    icon_url: string | null,
  ) {
    const category = await prisma.foodCategory.create({
      data: { name, tipo, icon_url },
    });

    const localNotificationService = new LocalNotificationService();
    localNotificationService.sendCategoryNotification(name)
      .catch(e => console.error("Error disparando notificacion:", e));

    return category;
  }

  // Actualizar una categoría existente
  async updateFoodCategory(
    id: number,
    name: string,
    tipo: TypesCategory,
    icon_url: string | null,
  ) {
    return prisma.foodCategory.update({
      where: { id },
      data: { name, tipo, icon_url },
    });
  }

  // Eliminar una categoría de forma segura
  async deleteFoodCategory(id: number) {
    const foods = await prisma.food.findMany({
      where: { category_id: id },
      select: { name: true },
      take: 3
    });

    if (foods.length > 0) {
      const foodNames = foods.map(f => f.name).join(", ");
      const more = await prisma.food.count({ where: { category_id: id } }) - foods.length;
      throw new Error(`No se puede eliminar: Hay platos asociados (${foodNames}${more > 0 ? ` y ${more} más` : ""}). Primero cámbiales la categoría.`);
    }

    // 2. Limpieza de relaciones en una transacción
    return prisma.$transaction(async (tx) => {
      // a. Desvincular de Preferencias de Usuario
      await tx.userPreference.deleteMany({
        where: { food_category_id: id }
      });

      // b. Desvincular de todos los Locales (Join Table Implicit m-n)
      // En Prisma, al borrar el nodo padre de una relación implícita, 
      // se borran las entradas en la tabla intermedia automáticamente.
      // Sin embargo, para estar 100% seguros de evitar errores de restricción:
      await tx.foodCategory.update({
        where: { id },
        data: {
          locals: { set: [] }
        }
      });

      // c. Finalmente, eliminar la categoría
      return tx.foodCategory.delete({
        where: { id }
      });
    });
  }

  async createLocalMenuCategory(categoryId: number, localId: string) {
    // Solo conectamos si la categoría ya existe
    return prisma.local.update({
      where: { id: localId },
      data: {
        categories: { connect: { id: categoryId } },
      },
      include: { categories: true },
    });
  }

  async deleteLocalMenuCategory(categoryId: number, localId: string) {
    return prisma.local.update({
      where: { id: localId },
      data: {
        categories: { disconnect: { id: categoryId } },
      },
    });
  }
}
