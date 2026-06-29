import { prisma } from "@/core/database/prisma/prisma";

import { PostDTO } from "@/shared/interfaces/dto/post.dto";
import { RecipeDTO } from "@/shared/interfaces/dto/recipe.dto";

import { generateSlug } from "@/shared/utils/sluglify";
import { getSocketServer } from "@/core/config/socket.config";
import {
  Post,
  Recipe,
  Community,
  ContentType,
  Vote,
  VoteType,
  Prisma,
  NotificationContentType,
} from "@prisma/client";

export class PostService {
  private async sendNotification(
    post: Post & {
      community?: Partial<Community> | null;
    },
    recipe?: Recipe,
  ) {
    if (!post.community_id) return;

    try {
      const members = await prisma.communityMember.findMany({
        where: {
          community_id: post.community_id,
          user_id: { not: post.user_id },
          receives_notifications: "ALWAYS",
          user: {
            notificationsPref: "ALWAYS",
          },
        },
        select: { user_id: true },
      });

      if (members.length === 0) return;

      const userIds = members.map((m) => m.user_id);

      const message = recipe
        ? `Nuevo post con receta en "${post.community?.name || "Comunidad"}": "${post.title}"`
        : `Nuevo post en "${post.community?.name || "Comunidad"}": "${post.title}"`;

      const metadata = {
        params: {
          slug: post.slug,
        },
        message: post.content,
      };

      await prisma.notification.createMany({
        data: userIds.map((id) => ({
          user_id: id,
          content_type: "POST",
          content_id: post.id,
          title: post.title,
          message,
          metadata,
        })),
      });

      const io = getSocketServer();
      io.to(userIds).emit("new_post", {
        content_type: NotificationContentType.POST,
        content_id: post.id,
        title: post.title,
        message,
        metadata,
        created_at: new Date().toISOString(),
      });
    } catch (e: any) {
      throw new Error(e.message || "Error al enviar notificación de post");
    }
  }

  // OBTENER TODOS LOS POSTS
  // =========================================================
  async getAll(page: number, user_id: string) {
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

      const whereCondition: any = {
        active: true,
      };

      if (communityIds.length > 0) {
        whereCondition.OR = [
          { community_id: { in: communityIds } },
          { user_id },
        ];
      }

      const posts = await prisma.post.findMany({
        where: whereCondition,
        include: {
          community: {
            select: {
              id: true,
              name: true,
              image_url: true,
              slug: true,
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
        user_vote: voteMap.get(post.id) || null,
        has_voted: voteMap.has(post.id),
      }));

      const hasMore = data.length === size;

      return {
        data,
        pagination: { page, hasMore },
      };
    } catch (e: any) {
      throw new Error(e.message || "Error al obtener posts");
    }
  }

  // OBTENER POSTS DE LA COMUNIDAD
  // =========================================================
  async getCommunityPosts(page: number, community_id: string, user_id: string) {
    try {
      const size = 20;

      const currentPage = Math.max(1, page);
      const skip = (currentPage - 1) * size;

      const posts = await prisma.post.findMany({
        where: {
          community_id,
          active: true,
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
    } catch (e: any) {
      throw new Error(e.message || "Error al obtener posts de la comunidad");
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
  async create(user_id: string, post: PostDTO, recipe?: RecipeDTO) {
    try {
      const data: Prisma.PostCreateInput = {
        title: post.title,
        slug: generateSlug(post.title),
        content: post.content,
        image_urls: post.image_urls,

        user: { connect: { id: user_id } },
        community: { connect: { id: post.community_id } },
      };

      if (recipe) {
        data.recipe = {
          create: {
            name: recipe.name,
            slug: generateSlug(recipe.name),
            description: recipe.description,
            total_time: recipe.total_time,
            main_image: recipe.main_image,
            user: { connect: { id: user_id } },
            steps: {
              create: recipe.steps?.map((step) => ({
                step_number: step.step_number,
                description: step.description,
                estimated_time: step.estimated_time ?? 0,
              })),
            },
            ingredients: {
              create: recipe.ingredients?.map((ing) => ({
                ingredient_id: ing.ingredient_id,
                quantity: ing.quantity,
                unit: ing.unit,
                notes: ing.notes,
              })),
            },
          },
        };
      }

      const result = await prisma.post.create({
        data: data,
        include: {
          community: true,
          user: {
            select: {
              id: true,
              name: true,
              avatar_url: true,
              slug: true,
            },
          },
          recipe: {
            include: {
              steps: true,
              ingredients: true,
            },
          },
        },
      });

      if (result) {
        this.sendNotification(result, result.recipe || undefined).catch(
          (err) => {
            throw new Error(
              err.message || "Error al enviar notificaciones de nuevo post",
            );
          },
        );
      }

      return result;
    } catch (e) {
      throw e;
    }
  }

  // ELIMINAR POST
  // =========================================================
  async delete(post_id: string, user_id: string) {
    try {
      const post = await prisma.post.findUnique({
        where: { id: post_id },
        include: {
          community: true,
        },
      });

      if (!post) {
        const e = new Error("Post no encontrado") as any;
        e.status = 404;
        throw e;
      }

      const isPostCreator = post.user_id === user_id;

      const member = await prisma.communityMember.findUnique({
        where: {
          user_id_community_id: {
            user_id: user_id,
            community_id: post.community_id,
          },
        },
      });
      const isModerator =
        member?.is_moderator || post.community.creator_id === user_id;

      if (!isPostCreator && !isModerator) {
        const e = new Error(
          "No tienes permisos para eliminar este post",
        ) as any;
        e.status = 403;
        throw e;
      }

      await prisma.post.update({
        where: { id: post_id },
        data: { active: false },
      });

      return post;
    } catch (e) {
      throw e;
    }
  }
}
