import { prisma } from "../../../core/database/prisma/prisma";

export class FoodService {
  async createFoodsFromOcr(
    localId: string,
    dishes: { name: string; price: number }[]
  ) {
    return await Promise.all(
      dishes.map((dish) =>
        prisma.food.create({
          data: {
            local_id: localId,
            name: dish.name,
            price: dish.price,
            description: null,
            image_url: null,
            available: true,
          },
        })
      )
    );
  }

  async updateFood(
    foodId: string,
    data: {
      name?: string;
      price?: number;
      description?: string;
      image_url?: string;
      available?: boolean;
      category_id?: number;
      local_menu_category_id?: number;
    }
  ) {
    return await prisma.food.update({
      where: { id: foodId },
      data,
    });
  }

  async deleteFood(foodId: string) {
    return await prisma.food.update({
      where: {
        id: foodId,
      },
      data: {
        available: false,
      },
    });
  }

  async getFoodsByLocal(localId: string) {
    return await prisma.food.findMany({ where: { local_id: localId } });
  }

  async getFoodById(foodId: string) {
    return await prisma.food.findUnique({ where: { id: foodId } });
  }
}
