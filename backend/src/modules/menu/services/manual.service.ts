import { prisma } from "../../../core/database/prisma/prisma";

export class ManualService {
  async createFood(
    localId: string,
    data: {
      category_id: number;
      name: string;
      description?: string;
      price: number;
      image_url?: string;
      available?: boolean;
    }
  ) {
    const local = await prisma.local.findUnique({
      where: { id: localId },
    });
    if (!local) {
      throw new Error("Local not found");
    }

    const food = await prisma.food.create({
      data: {
        local_id: localId,
        category_id: data.category_id, // Prisma exige un Int, nunca null
        name: data.name,
        description: data.description || null,
        price: data.price,
        image_url: data.image_url || null,
        available: data.available ?? true,
      },
    });

    return food;
  }

  async updateFood(
    foodId: string,
    data: {
      category_id?: number;
      name?: string;
      description?: string;
      price?: number;
      image_url?: string;
      available?: boolean;
    }
  ) {
    const existingFood = await prisma.food.findUnique({
      where: { id: foodId },
    });
    if (!existingFood) {
      throw new Error("Food not found");
    }

    const updatedFood = await prisma.food.update({
      where: { id: foodId },
      data: {
        category_id: data.category_id, // Si es undefined, Prisma simplemente no lo actualiza
        name: data.name,
        description: data.description,
        price: data.price,
        image_url: data.image_url,
        available: data.available,
      },
    });

    return updatedFood;
  }

  async createFoodsBulk(
    localId: string,
    dishes: Array<any>
  ) {
    const local = await prisma.local.findUnique({
      where: { id: localId },
    });
    if (!local) {
      throw new Error("Local no encontrado");
    }

    // 1. BUSCAMOS UNA CATEGORÍA VÁLIDA DE RESCATE
    // Buscamos la primera categoría disponible en la base de datos
    const fallbackCategory = await prisma.foodCategory.findFirst();
    
    if (!fallbackCategory) {
      throw new Error("Debes crear al menos una categoría en el sistema antes de subir un menú por foto.");
    }

    // 2. GUARDAMOS LOS PLATOS CON SEGURIDAD EXTREMA
    const foods = await prisma.$transaction(
      dishes.map((dish) =>
        prisma.food.create({
          data: {
            local_id: localId,
            // Asignamos la categoría del plato, o la de rescate si el OCR no trajo ninguna
            category_id: dish.category_id ? Number(dish.category_id) : fallbackCategory.id,
            name: String(dish.name),
            description: dish.description ? String(dish.description) : null,
            price: Number(dish.price) || 0,
            image_url: dish.image_url || null,
            available: dish.available ?? true,
          },
        })
      )
    );

    return foods;
  }
}