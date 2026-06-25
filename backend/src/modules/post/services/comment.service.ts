import {
  Community,
  ContentType,
  NotificationContentType,
  Post,
  PostComment,
  User,
  Vote,
  VoteType,
} from "@prisma/client";
import { getSocketServer } from "@/core/config/socket.config";
import { prisma } from "@/core/database/prisma/prisma";
import { CreateNotificationDTO } from "@/modules/notification/types/notification.dto";

export class CommentService {
  private async sendNotification(
    comment: PostComment & {
      user: User;
      post: Post & { community: Community };
      reply_to_user?: User | null;
      parent_comment?: { user: User } | null;
    },
  ) {
    try {
      const isReply = comment.parent_comment_id !== null;
      const communityId = comment.post.community_id;
      const commenter = comment.user;

      const recipients = new Set<string>();

      // 1. Determinar los destinatarios
      if (!isReply) {
        // Comentario directo al post: notificar al creador del post
        if (comment.post.user_id !== comment.user_id) {
          recipients.add(comment.post.user_id);
        }
      } else {
        // Respuesta a un comentario:
        // - Notificar al creador del comentario padre
        const parentCommentAuthorId = comment.parent_comment?.user?.id;
        if (
          parentCommentAuthorId &&
          parentCommentAuthorId !== comment.user_id
        ) {
          recipients.add(parentCommentAuthorId);
        }

        // - Notificar al usuario al que se le responde (si es distinto al parent y de sí mismo)
        if (
          comment.reply_to_user_id &&
          comment.reply_to_user_id !== comment.user_id
        ) {
          recipients.add(comment.reply_to_user_id);
        }
      }

      if (recipients.size === 0) return;

      // 2. Filtrar destinatarios según sus preferencias de notificación de la comunidad y preferencias globales
      const validRecipients: string[] = [];

      for (const id of recipients) {
        // Verificar preferencia global
        const user = await prisma.user.findUnique({
          where: { id: id },
          select: { notificationsPref: true },
        });
        if (user?.notificationsPref === "NONE") continue;

        // Verificar si es miembro de la comunidad y si tiene notificaciones habilitadas
        const member = await prisma.communityMember.findUnique({
          where: {
            user_id_community_id: {
              user_id: id,
              community_id: communityId,
            },
          },
          select: { receives_notifications: true },
        });

        // Si no es miembro de la comunidad, o si explícitamente tiene la preferencia en "NONE", no le enviamos
        if (!member || member.receives_notifications === "NONE") continue;

        validRecipients.push(id);
      }

      if (validRecipients.length === 0) return;

      // 3. Crear las notificaciones en la Base de Datos para cada destinatario válido
      const notifications: CreateNotificationDTO[] = validRecipients.map(
        (recipientId) => {
          let message = "";
          if (isReply) {
            const isParentAuthor =
              comment.parent_comment?.user?.id === recipientId;
            if (isParentAuthor) {
              message = `${commenter.name} respondió a tu comentario en "${comment.post.title}".`;
            } else {
              message = `${commenter.name} te mencionó en un comentario en "${comment.post.title}".`;
            }
          } else {
            message = `${commenter.name} comentó en tu post: "${comment.post.title}".`;
          }

          return {
            user_id: recipientId,
            content_type: NotificationContentType.COMMENT,
            content_id: comment.id,
            title: comment.post.title,
            message,
            metadata: {
              message: comment.content,
              params: {
                slug: comment.post.slug,
              },
            },
          };
        },
      );

      await prisma.notification.createMany({
        data: notifications,
      });

      const io = getSocketServer();
      for (const n of notifications) {
        try {
          io.to(n.user_id).emit("new_comment", {
            content_type: NotificationContentType.COMMENT,
            content_id: comment.id,
            title: comment.post.title,
            message: n.message,
            metadata: n.metadata,
            created_at: new Date().toISOString(),
          });
          console.log(
            `[Socket] Notificación de comentario enviada a ${n.user_id}`,
          );
        } catch (e: any) {
          throw new Error(e.message || "Error al enviar notificación de post");
        }
      }
    } catch (e: any) {
      throw new Error(e.message || "Error al enviar notificación de post");
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
          reply_to_user: {
            select: { id: true, name: true, slug: true, avatar_url: true },
          },
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
    parent_comment_id: string | null,
    reply_to_user_id: string | null,
  ) {
    let e: any;

    const exist = await prisma.post.findUnique({
      where: { id: post_id },
      select: {
        id: true,
      },
    });

    if (!exist) {
      e = new Error("El post no existe.");
      e.status = 404;
      throw e;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const comment = await tx.postComment.create({
          data: {
            content,
            post_id,
            user_id,
            parent_comment_id,
            reply_to_user_id,
          },

          include: {
            user: {
              // Autor del comentario
              select: {
                id: true,
                name: true,
                slug: true,
                avatar_url: true,
              },
            },
            post: {
              // Post al que se comenta
              include: {
                community: true,
              },
            },
            ...(reply_to_user_id && {
              reply_to_user: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  avatar_url: true,
                },
              },
            }),

            ...(parent_comment_id && {
              parent_comment: {
                select: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      avatar_url: true,
                    },
                  },
                },
              },
            }),
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
        this.sendNotification(result as any).catch((err) => {
          throw new Error(
            err.message || "Error al enviar notificación de comentario",
          );
        });
      }

      return result;
    } catch (e) {
      throw e;
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
