import { prisma } from "../../../core/database/prisma/prisma";
import { Prisma } from "@prisma/client";
import { CommunityDTO } from "../../../shared/interfaces/dto/community.dto";
import { generateSlug } from "../../../shared/utils/sluglify";

export class CommunityService {
  // CREAR COMUNIDAD
  // =========================================================
  async create(community: CommunityDTO, user_id: string) {
    try {
      const result = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const result = await tx.community.create({
            data: {
              name: community.name,
              slug: generateSlug(community.name),
              description: community.description,
              image_url: community.image_url,
              banner_url: community.banner_url,
              creator_id: user_id,
              total_members: 1,
              tags: {
                connect: community.tags.map((id) => ({ id })),
              },
            },
          });

          await tx.communityMember.create({
            data: {
              user_id: user_id,
              community_id: result.id,
              is_moderator: true,
            },
          });
          return result;
        },
      );
      return result;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2002") {
          const target = e.meta?.target as string[];

          if (target.includes("name")) {
            throw new Error("Ya existe una comunidad con este nombre.");
          }
          if (target.includes("slug")) {
            throw new Error("Error de colisión, por favor intenta de nuevo.");
          }
        }
      }
      throw e;
    }
  }

  // UNIRSE O ABANDONAR UNA COMUNIDAD
  // =========================================================
  async joinLeave(user_id: string, community_id: string, join: boolean) {
    try {
      const result = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const exists = await tx.communityMember.findUnique({
            where: {
              user_id_community_id: { user_id, community_id },
            },
          });

          if (exists && join) {
            throw new Error("Ya perteneces a la comunidad");
          }

          if (!exists && !join) {
            throw new Error("No es miembro");
          }

          let member;
          if (join) {
            member = await tx.communityMember.create({
              data: {
                user_id,
                community_id,
              },
            });

            await tx.community.update({
              where: { id: community_id },
              data: { total_members: { increment: 1 } },
            });
          } else {
            member = await tx.communityMember.delete({
              where: {
                user_id_community_id: { user_id, community_id },
              },
            });

            await tx.community.update({
              where: { id: community_id },
              data: { total_members: { decrement: 1 } },
            });
          }

          return member;
        },
      );
      return result;
    } catch (e) {
      throw new Error(`${e}`);
    }
  }

  // OBTENER COMUNIDAD (by slug)
  // =========================================================
  async getBySlug(slug: string, user_id?: string) {
    try {
      const community = await prisma.community.findUnique({
        where: { slug },
        include: {
          tags: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!community) {
        throw new Error("Comunidad no encontrada");
      }

      let isMember = false;
      let receives_notifications: string | null = null;

      if (user_id) {
        const member = await prisma.communityMember.findFirst({
          where: {
            community_id: community.id,
            user_id,
          },
          select: {
            receives_notifications: true,
          },
        });

        if (member) {
          isMember = true;
          receives_notifications = member.receives_notifications;
        }
      }

      return {
        ...community,
        isMember,
        receives_notifications,
      };
    } catch (e) {
      throw new Error(`Error al obtener comunidad: ${e}`);
    }
  }

  // OBTENER COMUNIDAD (by name)
  // =========================================================
  async getByName(name: string) {
    try {
      const community = await prisma.community.findFirst({
        where: {
          name: { contains: name.trim(), mode: "insensitive" },
          active: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          image_url: true,
          description: true,
          total_members: true,
          tags: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!community) {
        return null;
      }

      return community;
    } catch (e: any) {
      return null;
    }
  }

  // OBTENER COMUNIDADES DEL USUARIO
  // =========================================================
  async getUserCommunities(user_id: string) {
    try {
      const result = await prisma.communityMember.findMany({
        where: { user_id },
        select: {
          community: {
            select: {
              id: true,
              name: true,
              slug: true,
              image_url: true,
              description: true,
              total_members: true,
              tags: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
      return result;
    } catch (e) {
      throw new Error(`Error al obtener comunidades del usuario: ${e}`);
    }
  }

  // OBTENER COMUNIDAD (by category)
  // =========================================================
  async getByTagSkeleton(tag_id: number) {
    try {
      const result = await prisma.community.findMany({
        where: {
          tags: {
            some: {
              id: tag_id,
            },
          },
        },
        take: 10,
        orderBy: { total_members: "desc" },

        select: {
          id: true,
          name: true,
          slug: true,
          image_url: true,
          description: true,
          total_members: true,
        },
      });
      return result;
    } catch (e) {
      throw new Error(`Error al obtener comunidades por tag: ${e}`);
    }
  }

  // OBTENER COMUNIDAD (by tag) (PAGINATION)
  // =========================================================
  async getCommunitiesByTag(tagId: number) {
    try {
      const communities = await prisma.community.findMany({
        where: {
          tags: {
            some: {
              category: {
                is: {
                  id: tagId,
                },
              },
            },
          },
        },
        include: { tags: true },
      });

      return communities;
    } catch (error) {
      console.error("Error fetching communities by tag:", error);
      throw new Error("Failed to fetch communities by tag.");
    }
  }
}
