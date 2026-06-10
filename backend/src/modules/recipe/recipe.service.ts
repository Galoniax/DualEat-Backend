import { Ingredient } from "@prisma/client";
import { prisma } from "@/core/database/prisma/prisma";

export class RecipeService {
  // OBTENER INGREDIENTES
  // =========================================================
  async getAllIngredients() {
    try {
      const result = await prisma.ingredient.findMany({
        select: {
          id: true,
          name: true,
          fat: true,
          calories: true,
          carbs: true,
          proteins: true,
        },
      });
      return result;
    } catch (e) {
      return null;
    }
  }

  // OBTENER RECETA POR ID
  // =========================================================
  async getById(id: string) {
    try {
      const [recipe, votes] = await Promise.all([
        prisma.recipe.findUnique({
          where: { id },
          include: {
            ingredients: {
              include: {
                ingredient: true,
              },
            },
            steps: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar_url: true,
                slug: true,
              },
            },
          },
        }),
        prisma.post.aggregate({
          _sum: {
            votes_up: true,
            votes_down: true,
          },
          where: {
            recipe_id: id,
          },
        }),
      ]);

      return {
        ...recipe,
        votes_up: votes?._sum?.votes_up || 0,
        votes_down: votes?._sum?.votes_down || 0,
      };
    } catch (e) {
      return null;
    }
  }

  // OBTENER RECETAS POR IDs
  // =========================================================
  async getByIds(ids: string[]) {
    try {
      const result = await prisma.recipe.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          main_image: true,
          total_time: true,
          user: {
            select: {
              id: true,
              name: true,
              avatar_url: true,
              slug: true,
            },
          },
        },
      });
      return result;
    } catch (e) {
      return null;
    }
  }

  // OBTENER RECETAS DEL USUARIO
  // =========================================================
  async getUserRecipes(user_id: string) {
    try {
      const result = await prisma.recipe.findMany({
        where: { user_id },
        include: {
          ingredients: {
            include: {
              ingredient: true,
            },
          },
          steps: true,
        },
      });
      return result;
    } catch (e) {
      return null;
    }
  }

  // BUSCAR RECETAS
  // =========================================================
  async searchRecipes(
    query: string,
    ingredients: Ingredient[] | null,
    page: number,
  ) {
    try {
      const size = 5;
      const currentPage = Math.max(1, page);
      const skip = (currentPage - 1) * size;

      const words = query.split(" ").filter((word) => word.length > 3);

      const result = await prisma.recipe.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            {
              AND: words.map((word) => ({
                name: { contains: word, mode: "insensitive" },
              })),
            },
            {
              ingredients: {
                every: {
                  ingredient: {
                    name: { contains: query, mode: "insensitive" },
                  },
                },
              },
            },

            ...(ingredients && ingredients.length > 0
              ? [
                  {
                    ingredients: {
                      every: {
                        ingredient_id: {
                          in: ingredients.map((ing) => ing.id),
                        },
                      },
                    },
                  },
                ]
              : []),
          ],
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar_url: true,
              slug: true,
            },
          },
          _count: {
            select: {
              ingredients: true,
              steps: true,
            },
          },
        },
        orderBy: {
          created_at: "desc",
        },
        take: size + 1,
        skip,
      });

      const hasMore = result.length > size;
      if (hasMore) result.pop();

      const recipeIds = result.map((recipe) => recipe.id);

      const votes = await prisma.post.groupBy({
        by: ["recipe_id"],
        _sum: {
          votes_up: true,
          votes_down: true,
        },
        where: {
          recipe_id: { in: recipeIds },
        },
      });

      const data = result.map((recipe) => {
        const recipeVotes = votes.find((v) => v.recipe_id === recipe.id);

        return {
          ...recipe,
          votes_up: recipeVotes?._sum?.votes_up || 0,
          votes_down: recipeVotes?._sum?.votes_down || 0,
        };
      });

      return {
        data: data,
        pagination: {
          page: currentPage,
          hasMore,
        },
      };
    } catch (e) {
      return null;
    }
  }
}
