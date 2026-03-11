import { prisma } from "../../../core/database/prisma/prisma";
import { User } from "@prisma/client";
import { Workplace } from "../../../shared/interfaces/user.dto";
import { BasicCreateDTO } from "../../../shared/interfaces/user.dto";

export type UserWithWorkplaces = User & {
  workplaces: Workplace[];
};

export class UserService {
  constructor() {}

  // ============================================================
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

  // ============================================================
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

  // ============================================================
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

  // ============================================================
  // OBTENER USUARIO POR ID
  // ============================================================
  async getById(userId: string): Promise<User | null> {
    try {
      const result = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          preferences: true,
        },
      });
      return result;
    } catch (error) {
      console.error("Error al buscar usuario por ID:", error);
      throw error;
    }
  }

  // ============================================================
  // ACTUALIZAR USUARIO
  // ============================================================
  async update(userId: string, data: any) {
    try {
      const result = await prisma.user.update({
        where: { id: userId },
        data,
      });
      return result;
    } catch (error) {
      console.error("Error al actualizar usuario:", error);
      throw error;
    }
  }
}
