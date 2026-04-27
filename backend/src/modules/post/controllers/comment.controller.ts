import { Request, Response } from "express";
import { CommentService } from "../services/comment.service";

export class CommentController {
  constructor(private commentService: CommentService) {}

  // =========================================================
  // CREAR COMENTARIO
  // =========================================================
  create = async (req: Request, res: Response) => {
    const { post_id, content, parent_comment_id } = req.body as {
      post_id: string;
      content: string;
      parent_comment_id?: string;
    };

    const user_id = (req as any).user?.id || req.body.user_id;

    if (!post_id || !content) {
      return res
        .status(400)
        .json({ success: false, message: "Faltan datos requeridos" });
    }

    try {
      const comment = await this.commentService.create(
        String(post_id),
        String(content),
        String(user_id),
        parent_comment_id ? String(parent_comment_id) : null,
      );

      if (!comment) {
        return res
          .status(400)
          .json({ success: false, message: "Error al crear el comentario" });
      }

      return res.status(201).json({ success: true, data: comment });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };

  // =========================================================
  // OBTENER COMENTARIOS DE UN POST
  // =========================================================
  getComments = async (req: Request, res: Response) => {
    const { post_id } = req.params as { post_id: string };
    const { page } = req.query;

    const user_id = (req as any).user?.id || req.query.user_id;

    if (typeof page !== "string" || isNaN(Number(page))) {
      return res.status(400).json({
        success: false,
        message: "El número de página no es válido.",
      });
    }

    if (!post_id) {
      return res
        .status(400)
        .json({ success: false, message: "Id no encontrado" });
    }

    try {
      const comments = await this.commentService.getComments(
        String(post_id),
        Number(page),
        String(user_id),
      );
      if (!comments) {
        return res
          .status(404)
          .json({ success: false, message: "Comentarios no encontrados" });
      }

      return res.status(200).json({ success: true, ...comments });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };

  // =========================================================
  // OBTENER RESPUESTAS DE UN COMENTARIO
  // =========================================================
  getReplies = async (req: Request, res: Response) => {
    const { comment_id } = req.params as { comment_id: string };
    const { page } = req.query;

    const user_id = (req as any).user?.id || req.query.user_id;

    if (typeof page !== "string" || isNaN(Number(page))) {
      return res.status(400).json({
        success: false,
        message: "El número de página no es válido.",
      });
    }

    if (!comment_id) {
      return res
        .status(400)
        .json({ success: false, message: "Id no encontrado" });
    }

    try {
      const replies = await this.commentService.getReplies(
        String(comment_id),
        Number(page),
        String(user_id),
      );
      if (!replies) {
        return res
          .status(404)
          .json({ success: false, message: "Comentarios no encontrados" });
      }

      return res.status(200).json({ success: true, ...replies });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };

  // =========================================================
  // ELIMINAR COMENTARIO
  // =========================================================
  delete = async (req: Request, res: Response) => {
    const { comment_id } = req.params as { comment_id: string };

    const user_id = (req as any).user?.id || req.body.user_id;

    if (!comment_id) {
      return res
        .status(400)
        .json({ success: false, message: "Id no encontrado" });
    }

    try {
      const result = await this.commentService.delete(comment_id, user_id);

      if (!result) {
        return res
          .status(404)
          .json({ success: false, message: "Comentario no encontrado" });
      }

      return res.status(200).json({
        success: true,
        message: "Comentario eliminado",
      });
    } catch (e: any) {
      return res.status(400).json({
        success: false,
        message: e.message,
      });
    }
  };
}
