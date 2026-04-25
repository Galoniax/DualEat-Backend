import { prisma } from "../../../core/database/prisma/prisma";

export class FoodService {
  async createFoodsFromOcr(
    localId: string,
    dishes: { name: string; price: number }[],
  ) {
    return await Promise.all(
      dishes.map((dish) =>
        prisma.food.create({
          data: {
            local_id: localId,
            
            name: dish.name,
            price: dish.price,
            description: null,
            category_id: 1,
            image_url: null,
            available: true,
          },
        }),
      ),
    );
  }

  async getFoodsByLocalId(localId: string) {
    return await prisma.food.findMany({
      where: { local_id: localId },
    });
  }

  async getLocalWithMenu({ id, slug }: { id?: string; slug?: string }) {
    try {
      const localWhere = id ? { id } : { slug };

      const local = await prisma.local.findUnique({
        where: localWhere,
        include: {
          promotions: {
            where: { active: true, discount_pct: { gt: 0 }, food_id: null },
          },
          categories: {
            where: {
              foods: {
                some: {}
              }
            },
            include: {
              foods: {
                
                where: id ? { local_id: id } : { local: { slug: slug } },
                include: {
                  promotions: {
                    where: { active: true, discount_pct: { gt: 0 } },
                  },
                  _count: {
                    select: { order_items: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!local) return null;

      const maxGlobalDiscount = local.promotions.reduce(
        (max, p) => Math.max(max, p.discount_pct || 0), 0
      );

      const categoriesWithDiscounts = local.categories.map((category) => {
        const foodsWithDiscounts = category.foods.map((food) => {
          const specificPromo = food.promotions; 

          let appliedDiscountPct = 0;
          if (specificPromo && specificPromo.discount_pct) {
            appliedDiscountPct = specificPromo.discount_pct;
          } else if (maxGlobalDiscount > 0) {
            appliedDiscountPct = maxGlobalDiscount;
          }

          let finalPrice = food.price;
          if (appliedDiscountPct > 0) {
            finalPrice = food.price - food.price * (appliedDiscountPct / 100);
          }

          const { promotions, _count, ...foodData } = food;
          return {
            ...foodData,
            original_price: food.price,
            price: finalPrice,
            discount_pct_applied: appliedDiscountPct > 0 ? appliedDiscountPct : null,
            ends_at: specificPromo?.ends_at || null,
            sales_count: _count.order_items || 0,
          };
        });

        return { ...category, foods: foodsWithDiscounts };
      });

      return {
        ...local,
        categories: categoriesWithDiscounts,
      };

    } catch (e) {
      console.error("Error obteniendo menú:", e);
      return null;
    }
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
    },
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

  async getFoodById(foodId: string) {
    return await prisma.food.findUnique({ where: { id: foodId } });
  }

  async getFoodsByIds(foodIds: string[]) {
    try {
      const foods = await prisma.food.findMany({
        where: {
          id: {
            in: foodIds,
          },
        },
        include: {
          promotions: {
            where: { active: true, discount_pct: { gt: 0 } },
          },
        },
      });
      return foods;
    } catch (e) {
      console.error("Error obteniendo platos por ID:", e);
      return null;
    }
  }
}
