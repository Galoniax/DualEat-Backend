import { prisma } from "@/core/database/prisma/prisma";
import { User } from "@prisma/client";
import { Workplace } from "@/shared/interfaces/dto/user.dto";
import { BasicCreateDTO } from "@/shared/interfaces/dto/user.dto";

export type UserWithWorkplaces = User & {
  workplaces: Workplace[];
};

export class UserService {
  constructor() {}

  // CREAR USUARIO
  // ============================================================
  async create(userData: BasicCreateDTO) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: userData.email,
            password_hash: userData.password_hash || "",
            slug: userData.slug,
            name: userData.name,
            avatar_url: userData.avatar_url,
            provider: userData.provider,
          },
        });

        // --- CAMBIO AQUÍ: Usar food_category_id para foodPreferences ---
        if (userData.foodPreferences?.length) {
          await tx.userPreference.createMany({
            data: userData.foodPreferences.map((foodId) => ({
              user_id: user.id,
              food_category_id: Number(foodId),
            })),
            skipDuplicates: true,
          });
        }

        // --- CAMBIO AQUÍ: Usar community_tag_id para communityPreferences ---
        if (userData.communityPreferences?.length) {
          await tx.userPreference.createMany({
            data: userData.communityPreferences.map((communityId) => ({
              user_id: user.id,
              community_tag_id: Number(communityId),
            })),
            skipDuplicates: true,
          });
        }

        return user;
      });
      return result;
    } catch (error) {
      console.error("Error al crear el usuario:", error);
      throw error;
    }
  }

  // OBTENER USUARIO POR EMAIL
  // ============================================================
  async getByEmail(email: string): Promise<UserWithWorkplaces | null> {
    try {
      const result = await prisma.user.findUnique({
        where: { email },
        include: {
          local_users: {
            select: {
              role: true,
              local: {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!result) return null;

      const workplaces: Workplace[] = result.local_users.map((lu) => ({
        id: lu.local.id,
        slug: lu.local.slug,
        name: lu.local.name,
        role: lu.role,
      }));

      const { local_users, ...userBaseData } = result;

      return {
        ...userBaseData,
        workplaces,
      };
    } catch (e) {
      console.log("Error al buscar usuario por email:", e);
      throw e;
    }
  }

  // ACTUALIZAR IMAGEN DE PERFIL
  // ============================================================
  async updateAvatar(userId: string, avatarUrl: string): Promise<User> {
    try {
      const result = await prisma.user.update({
        where: { id: userId },
        data: { avatar_url: avatarUrl },
      });
      return result;
    } catch (error) {
      console.error("Error al actualizar imagen de perfil:", error);
      throw error;
    }
  }

  // OBTENER USUARIO POR ID
  // ============================================================
  async getById(user_id: string) {
    try {
      const result = await prisma.user.findUnique({
        where: { id: user_id, active: true },
        include: {
          preferences: true,
        },
      });

      if (!result) throw new Error("Usuario no encontrado");

      return result;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  // OBTENER USUARIO POR SLUG
  // ============================================================
  async getUserSearch(
    query: string,
    tab: string,
    page: number,
    user_id: string,
  ) {
    try {
      const size = 20;
      const currentPage = Math.max(1, page);
      const skip = (currentPage - 1) * size;
      const cleanQuery = query.trim();
      const filter = { contains: cleanQuery, mode: "insensitive" } as const;

      let data: any[] = [];

      switch (tab) {
        case "posts":
          data = await prisma.post.findMany({
            where: {
              user_id: user_id,
              active: true,
              title: filter,
            },
            skip,
            take: size + 1,
            orderBy: { created_at: "desc" },
            include: {
              community: {
                select: { id: true, name: true, image_url: true, slug: true },
              },
              recipe: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  main_image: true,
                  total_time: true,
                  _count: { select: { steps: true, ingredients: true } },
                },
              },
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
          break;

        case "recipes":
          data = await prisma.recipe.findMany({
            where: {
              user_id: user_id,
              name: filter,
            },
            skip,
            take: size + 1,
            orderBy: { created_at: "desc" },
            select: {
              id: true,
              name: true,
              description: true,
              slug: true,
              main_image: true,
              total_time: true,
              _count: { select: { steps: true, ingredients: true } },
            },
          });
          break;

        case "comments":
          data = await prisma.postComment.findMany({
            where: {
              user_id: user_id,
              content: filter,
            },
            skip,
            take: size + 1,
            orderBy: { created_at: "desc" },
            select: {
              id: true,
              content: true,
              post: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  community: { select: { id: true, name: true, slug: true } },
                },
              },
            },
          });
          break;

        default:
          break;
      }

      const hasMore = data.length > size;
      if (hasMore) data.pop();

      return {
        data,
        pagination: { page: currentPage, hasMore },
      };
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  // ACTUALIZAR USUARIO
  // ============================================================
  async update(user_id: string, data: any) {
    try {
      const result = await prisma.user.update({
        where: { id: user_id },
        data,
      });
      return result;
    } catch (error) {
      console.error("Error al actualizar usuario:", error);
      throw error;
    }
  }
}
