import { prisma } from "../../core/database/prisma/prisma";

import { CreatePostDTO } from "../../shared/interfaces/dto/post.dto";
import { CreateRecipeDTO } from "../../shared/interfaces/dto/recipe.dto";

import { generateSlug } from "../../shared/utils/sluglify";
import { getSocketServer } from "../../core/config/socket.config";
import { Post, Recipe, Community, ContentType } from "@prisma/client";

import { interleaveByCommunity } from "../../shared/utils/shuffler";

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

  private async sendCommentNotification(
    post_id: string,
    user_id: string,
    content: string,
    parent_comment_id?: string | null,
  ) {
    try {
      let recipientUserId: string | null = null;
      let title = "";
      let message = "";

      // Obtener datos del usuario que comentó
      const commenter = await prisma.user.findUnique({
        where: { id: user_id },
        select: {
          name: true,
          avatar_url: true,
          slug: true,
        },
      });

      // Obtener datos del post completo
      const post = await prisma.post.findUnique({
        where: { id: post_id },
        include: {
          user: { select: { slug: true } },
          community: { select: { slug: true } },
        },
      });

      if (!post) return;

      title = post.title;

      if (parent_comment_id) {
        // Es una respuesta a otro comentario
        const parentComment = await prisma.postComment.findUnique({
          where: { id: parent_comment_id },
          select: { user_id: true },
        });

        if (parentComment && parentComment.user_id !== user_id) {
          recipientUserId = parentComment.user_id;
          message = commenter
            ? `${commenter.name} respondió a tu comentario en "${title}".`
            : `Alguien respondió a tu comentario en "${title}".`;
        }
      } else {
        // Es un comentario directo al post
        if (post.user_id !== user_id) {
          recipientUserId = post.user_id;
          message = commenter
            ? `${commenter.name} comentó en tu post: "${title}".`
            : `Alguien comentó en tu post: "${title}".`;
        }
      }

      if (recipientUserId) {
        await prisma.notification.create({
          data: {
            user_id: recipientUserId,
            content_type: "COMMENT",
            content_id: post_id,
            message,
            metadata: {
              title,
              message: content,
              type: "comment",
              imageURLs: {
                user: commenter?.avatar_url,
              },
              slugs: {
                community: post.community.slug,
                user: post.user.slug,
                post: post.slug,
              },
            },
          },
        });

        // Enviar por WebSocket si está conectado
        try {
          const socketServer = getSocketServer();
          socketServer.to(recipientUserId).emit("new_comment", {
            type: "comment_notification",
            postId: post_id,
            parentCommentId: parent_comment_id || null,
            message,
            metadata: {
              title,
              message: content,
              type: "comment",
              imageURLs: {
                user: commenter?.avatar_url,
              },
              slugs: {
                community: post.community.slug,
                user: post.user.slug,
                post: post.slug,
              },
            },
          });

          console.log(
            `[Socket] Notificación de comentario enviada a ${recipientUserId}`,
          );
        } catch (socketError) {
          console.error(
            "Error al enviar notificación por Socket.io:",
            socketError,
          );
        }
      }
    } catch (error) {
      console.error("Error al enviar notificación de comentario:", error);
    }
  }

  /** GET ALL POSTS */
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

  // =========================================================
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
          comments: {
            where: { active: true },
            orderBy: { created_at: "asc" },
            include: {
              user: {
                select: { id: true, name: true, slug: true, avatar_url: true },
              },
            },
          },
        },
      });

      if (!post) return null;

      const { comments, ...postBaseData } = post;

      let postVote = null;
      let commentVotes: any[] = [];

      if (user_id) {
        const [pVote, cVotes] = await Promise.all([
          prisma.vote.findFirst({
            where: {
              user_id,
              content_id: post_id,
              content_type: ContentType.POST,
            },
          }),
          comments.length > 0
            ? prisma.vote.findMany({
                where: {
                  user_id,
                  content_type: ContentType.COMMENT,
                  content_id: { in: comments.map((c) => c.id) },
                },
              })
            : Promise.resolve([]),
        ]);

        postVote = pVote;
        commentVotes = cVotes;
      }

      type EnrichedComment = (typeof comments)[0] & {
        userVote: string | null;
        replies: EnrichedComment[];
      };
      const commentMap = new Map<string, EnrichedComment>(
        comments.map((c) => [
          c.id,
          {
            ...c,
            userVote:
              commentVotes.find((v) => v.content_id === c.id)?.vote_type ??
              null,
            replies: [],
          },
        ]),
      );
      const rootComments: EnrichedComment[] = [];

      for (const comment of comments) {
        const enrichedComment = commentMap.get(comment.id)!;

        if (comment.parent_comment_id) {
          const parent = commentMap.get(comment.parent_comment_id);
          if (parent) {
            parent.replies.push(enrichedComment);
          }
        } else {
          rootComments.push(enrichedComment);
        }
      }

      return {
        ...postBaseData,
        userVote: postVote?.vote_type ?? null,
        comments: rootComments,
      };
    } catch (e) {
      return null;
    }
  }

  /** CREATE POST */
  async createPost(postData: CreatePostDTO, recipeData?: CreateRecipeDTO) {
    const recipeModel = recipeData ? prisma.recipe : null;
    const postModel = prisma.post;
    try {
      const slugPost = await generateReadableSlug(postData.title, postModel);
      if (recipeData) {
        const slugRecipe = await generateReadableSlug(
          recipeData.name,
          recipeModel,
        );
        const result = await prisma.$transaction(async (tx) => {
          const recipe = await tx.recipe.create({
            data: {
              name: recipeData.name,
              slug: slugRecipe,
              description: recipeData.description,
              main_image: recipeData.main_image,
              total_time: recipeData.total_time,
              user_id: recipeData.user_id,
              ingredients: {
                create: recipeData.ingredients,
              },
              steps: {
                create: recipeData.steps,
              },
            },
          });
          const post = await tx.post.create({
            data: {
              title: postData.title,
              slug: slugPost,
              content: postData.content,
              image_urls: postData.image_urls,
              user_id: postData.user_id,
              community_id: postData.community_id,
              recipe_id: recipe.id,
            },
            include: {
              community: true,
            },
          });
          await this.sendPostNotification(post, recipe);
          return { post, recipe };
        });

        return result;
      } else {
        const post = await prisma.post.create({
          data: {
            title: postData.title,
            slug: slugPost,
            content: postData.content,
            image_urls: postData.image_urls,
            user_id: postData.user_id,
            community_id: postData.community_id,
          },
          include: {
            community: true,
          },
        });
        await this.sendPostNotification(post);
        return post;
      }
    } catch (error) {
      throw new Error(`Error al crear el post: ${error}`);
    }
  }

  /** CREATE COMMENT */
  async createComment(
    post_id: string,
    user_id: string,
    content: string,
    parent_comment_id?: string | null,
  ) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const comment = await tx.postComment.create({
          data: {
            content,
            post_id,
            user_id,
            parent_comment_id,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                slug: true,
                avatar_url: true,
              },
            },
            replies: true,
          },
        });

        await tx.post.update({
          where: { id: post_id },
          data: {
            total_comments: {
              increment: 1,
            },
          },
        });

        return comment;
      });

      if (result) {
        await this.sendCommentNotification(
          post_id,
          user_id,
          content,
          parent_comment_id,
        );
      }

      return result;
    } catch (error) {
      console.error("Error al crear comentario:", error);
      throw new Error("No se pudo crear el comentario");
    }
  }
}
