import { prisma } from "../../../core/database/prisma/prisma";

import { PostDTO } from "../../../shared/interfaces/dto/post.dto";
import { RecipeDTO } from "../../../shared/interfaces/dto/recipe.dto";

import { generateSlug } from "../../../shared/utils/sluglify";
import { getSocketServer } from "../../../core/config/socket.config";
import { Post, Recipe, Community, ContentType, Vote, VoteType } from "@prisma/client";

export class PostService {
  private async sendPostNotification(
    post: Post & { community?: Community | null },
    recipe?: Recipe,
  ) {
    if (!post.community_id) {
      return;
    }

    // 1. Obtener miembros con notificaciones ALWAYS y FREQUENT (tiempo real)
    const immediateSubscribers = await prisma.communityMember.findMany({
      where: {
        community_id: post.community_id,
        user_id: {
          not: post.user_id,
        },
        receives_notifications: {
          in: ["ALWAYS"],
        },
      },
      select: { user_id: true },
    });

    // 3. Crear notificaciones en BD para usuarios con notificaciones inmediatas
    if (immediateSubscribers.length > 0) {
      const immediateUserIds = immediateSubscribers.map((m) => m.user_id);

      if (recipe) {
        await prisma.notification.createMany({
          data: immediateUserIds.map((userId) => ({
            user_id: userId,
            content_type: "POST",
            content_id: recipe.id,
            message: `Nuevo post con receta publicado en la comunidad: "${post.title}".`,
            metadata: {
              title: post.title,
              message: post.content,
              type: "post",
              imageURLs: {
                community: post.community?.image_url || "",
                post: recipe.main_image || "",
              },
              slugs: {
                community: post.community?.slug || "",
              },
            },
          })),
        });
      } else {
        await prisma.notification.createMany({
          data: immediateUserIds.map((userId) => ({
            user_id: userId,
            content_type: "POST",
            content_id: post.id,
            message: `Nuevo post publicado en la comunidad: "${post.title}.`,
            metadata: {
              title: post.title,
              message: post.content,
              type: "post",
              imageURLs: {
                community: post.community?.image_url || "",
                post: post.image_urls?.[0] || "",
              },
              slugs: {
                community: post.community?.slug || "",
              },
            },
          })),
        });
      }

      // 4. Enviar WebSocket a usuarios conectados (tiempo real)
      try {
        const socketServer = getSocketServer();
        socketServer.to(immediateUserIds).emit("new_community_post", {
          type: "community_post",
          postId: post.id,
          communityId: post.community_id,
          title: post.title,
          message: `Nuevo post publicado en la comunidad: "${post.title}.`,
        });

        console.log(
          `[Socket] Notificación inmediata enviada a ${immediateUserIds.length} usuarios por post en comunidad ${post.community_id}.`,
        );
      } catch (socketError) {
        console.error(
          "Error al enviar notificación por Socket.io:",
          socketError,
        );
      }
    }
  }

  // OBTENER TODOS LOS POSTS
  // =========================================================
  async getAllPosts(page: number, user_id: string) {
    try {
      const size = 10;
      const skip = (Math.max(1, page) - 1) * size;

      const relevantCommunities = await prisma.community.findMany({
        where: {
          OR: [
            { members: { some: { user_id } } },
            { tags: { some: { user_preferences: { some: { user_id } } } } },
          ],
        },
        select: { id: true },
      });

      const communityIds = relevantCommunities.map((c) => c.id);

      const posts = await prisma.post.findMany({
        where: {
          active: true,
          OR: [
            ...(communityIds.length > 0
              ? [{ community_id: { in: communityIds } }]
              : []),
            { user_id },
          ],
        },
        include: {
          community: {
            select: {
              name: true,
              image_url: true,
              slug: true,
            },
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
        },
        orderBy: { created_at: "desc" },
        skip,
        take: size,
      });

      const postIds = posts.map((p) => p.id);

      const userVotes = await prisma.vote.findMany({
        where: {
          user_id: user_id,
          content_type: "POST",
          content_id: { in: postIds },
        },
        select: { content_id: true, vote_type: true },
      });

      const voteMap = new Map(
        userVotes.map((v) => [v.content_id, v.vote_type]),
      );

      const data = posts.map((post) => ({
        ...post,
        userVote: voteMap.get(post.id) || null,
        hasVoted: voteMap.has(post.id),
      }));

      const hasMore = data.length === size;

      return {
        data,
        pagination: { page, hasMore },
      };
    } catch (e) {
      return null;
    }
  }

  // OBTENER POSTS DE LA COMUNIDAD
  // =========================================================
  async getCommunityPosts(
    page: number,
    community_id: string,
    user_id: string,
    title?: string,
  ) {
    try {
      const size = 20;

      const currentPage = Math.max(1, page);
      const skip = (currentPage - 1) * size;

      const posts = await prisma.post.findMany({
        where: {
          community_id,
          active: true,
          ...(title
            ? {
                title: {
                  contains: title.toString().trim(),
                  mode: "insensitive",
                },
              }
            : {}),
        },
        orderBy: {
          created_at: "desc",
        },
        skip,
        take: size + 1,
        include: {
          community: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          recipe: {
            select: {
              id: true,
              name: true,
              slug: true,
              main_image: true,
              total_time: true,
              _count: {
                select: {
                  steps: true,
                  ingredients: true,
                },
              },
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

      const hasMore = posts.length > size;
      if (hasMore) posts.pop();

      let votes: Vote[] = [];

      if (user_id) {
        votes = await prisma.vote.findMany({
          where: {
            user_id: user_id,
            content_type: ContentType.POST,
            content_id: {
              in: posts.map((p) => p.id),
            },
          },
        });
      }

      type EnrichedPost = (typeof posts)[0] & {
        user_vote: VoteType | null;
        has_voted: boolean;
      };

      const result = posts.map(
        (c): EnrichedPost => ({
          ...c,
          user_vote:
            votes.find((v) => v.content_id === c.id)?.vote_type ?? null,
          has_voted: votes.some((v) => v.content_id === c.id),
        }),
      );

      return {
        data: result,
        pagination: { page: currentPage, hasMore },
      };
    } catch (e) {
      return null;
    }
  }

  // OBTENER POST POR ID
  // =========================================================
  async getById(post_id: string, user_id: string) {
    try {
      const post = await prisma.post.findUnique({
        where: { id: post_id },
        include: {
          community: true,
          recipe: true,
          user: {
            select: { id: true, name: true, slug: true, avatar_url: true },
          },
          _count: {
            select: { comments: true },
          },
        },
      });

      if (!post) return null;

      let post_vote: Vote | null = null;

      if (user_id) {
        post_vote = await prisma.vote.findFirst({
          where: {
            user_id,
            content_id: post_id,
            content_type: ContentType.POST,
          },
        });
      }

      return {
        ...post,
        user_vote: post_vote?.vote_type ?? null,
        has_voted: post_vote !== null,
      };
    } catch (e) {
      return null;
    }
  }

  // CREAR POST
  // =========================================================
  async create(post: PostDTO, recipe?: RecipeDTO) {
    try {
      const payload: any = {
        title: post.title,
        slug: generateSlug(post.title),
        content: post.content,
        image_urls: post.image_urls,
        user_id: post.user_id,
        community_id: post.community_id,
      };

      if (recipe) {
        payload.recipe = {
          create: {
            name: recipe.name,
            slug: generateSlug(recipe.name),
            description: recipe.description,
            main_image: recipe.main_image,
            total_time: recipe.total_time,
            user_id: recipe.user_id,
            ingredients: {
              create: recipe.ingredients,
            },
            steps: {
              create: recipe.steps,
            },
          },
        };
      }

      // CREACIÓN DE POST & RECETA
      const postCreated = await prisma.post.create({
        data: payload,
        include: {
          community: true,
          recipe: !!recipe,
        },
      });

      if (recipe) {
        const result = postCreated as any;
        const recipe = result.recipe;

        delete result.recipe;

        return {
          post: result,
          recipe: recipe,
        };
      }

      return {
        post: postCreated,
        recipe: null,
      };
    } catch (e) {
      console.error("Error en Prisma:", e);
      return null;
    }
  }
}
