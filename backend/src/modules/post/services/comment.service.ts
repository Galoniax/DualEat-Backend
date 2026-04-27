import { ContentType, Vote, VoteType } from "@prisma/client";
import { getSocketServer } from "../../../core/config/socket.config";
import { prisma } from "../../../core/database/prisma/prisma";

export class CommentService {
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

  // OBTENER COMENTARIOS DE UN POST
  // =========================================================
  async getComments(post_id: string, page: number, user_id: string) {
    try {
      const size = 20;
      const currentPage = Math.max(1, page);
      const skip = (currentPage - 1) * size;

      const comments = await prisma.postComment.findMany({
        where: { post_id, active: true, parent_comment_id: null },
        orderBy: { created_at: "asc" },
        skip,
        take: size + 1,
        include: {
          user: {
            select: { id: true, name: true, slug: true, avatar_url: true },
          },
          _count: { select: { replies: { where: { active: true } } } },
        },
      });

      const hasMore = comments.length > size;
      if (hasMore) comments.pop();

      let votes: Vote[] = [];

      if (user_id) {
        votes = await prisma.vote.findMany({
          where: {
            user_id,
            content_type: ContentType.COMMENT,
            content_id: { in: comments.map((c) => c.id) },
          },
        });
      }

      type EnrichedComment = (typeof comments)[0] & {
        user_vote: VoteType | null;
        has_voted: boolean;
      };

      const result = comments.map(
        (c): EnrichedComment => ({
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
      console.error("Error en getComments:", e);
      return null;
    }
  }

  // OBTENER RESPUESTAS DE UN COMENTARIO
  // =========================================================
  async getReplies(comment_id: string, page: number, user_id: string) {
    try {
      const size = 10;
      const currentPage = Math.max(1, page);
      const skip = (currentPage - 1) * size;

      const replies = await prisma.postComment.findMany({
        where: { parent_comment_id: comment_id, active: true },
        orderBy: { created_at: "asc" },
        skip,
        take: size + 1,
        include: {
          user: {
            select: { id: true, name: true, slug: true, avatar_url: true },
          },
          parent_comment: {
            select: {
              user: {
                select: { id: true, name: true, slug: true, avatar_url: true },
              },
            },
          },
        },
      });

      const hasMore = replies.length > size;
      if (hasMore) replies.pop();

      console.log("Replies", replies);

      let votes: Vote[] = [];

      if (user_id) {
        votes = await prisma.vote.findMany({
          where: {
            user_id,
            content_type: ContentType.COMMENT,
            content_id: { in: replies.map((r) => r.id) },
          },
        });
      }

      type EnrichedReply = (typeof replies)[0] & {
        user_vote: VoteType | null;
        has_voted: boolean;
      };

      const result = replies.map(
        (r): EnrichedReply => ({
          ...r,
          user_vote:
            votes.find((v) => v.content_id === r.id)?.vote_type ?? null,
          has_voted: votes.some((v) => v.content_id === r.id),
        }),
      );

      return {
        data: result,
        pagination: { page: currentPage, hasMore },
      };
    } catch (e) {
      console.error("Error en getReplies:", e);
      return null;
    }
  }

  // CREAR COMENTARIO
  // =========================================================
  async create(
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
    } catch (e) {
      return null;
    }
  }

  // ELIMINAR COMENTARIO
  // =========================================================
  async delete(comment_id: string, requester_user_id: string) {
    try {
      const comment = await prisma.postComment.findUnique({
        where: { id: comment_id },
        include: {
          post: { select: { user_id: true } },
          _count: { select: { replies: true } },
        },
      });

      if (!comment) {
        throw new Error("El comentario no existe o ya fue eliminado");
      }

      const isCommentAuthor = comment.user_id === requester_user_id;
      const isPostOwner = comment.post.user_id === requester_user_id;

      if (!isCommentAuthor && !isPostOwner) {
        throw new Error("No tienes permisos para eliminar este comentario");
      }

      const commentsToSubtract = 1 + comment._count.replies;

      const result = await prisma.$transaction(async (tx) => {
        const deletedComment = await tx.postComment.delete({
          where: { id: comment_id },
        });
        await tx.post.update({
          where: { id: comment.post_id },
          data: {
            total_comments: {
              decrement: commentsToSubtract,
            },
          },
        });

        return deletedComment;
      });

      return result;
    } catch (e: any) {
      throw new Error(e.message || "No se pudo eliminar el comentario");
    }
  }
}
