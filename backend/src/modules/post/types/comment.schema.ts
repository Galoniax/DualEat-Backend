import { z } from "zod";

export const createCommentSchema = z.object({
  comment: z.object({
    post_id: z.coerce.string().nonempty("El post es requerido"),
    content: z.coerce
      .string()
      .min(1, "El contenido es requerido")
      .max(500, "El comentario es muy largo")
      .trim(),
    parent_comment_id: z
      .string()
      .nullish()
      .transform((val) => val ?? null),
    reply_to_user_id: z
      .string()
      .nullish()
      .transform((val) => val ?? null),
  }),
});

export const updateCommentSchema = z.object({
  content: z.coerce
    .string()
    .min(1, "El contenido es requerido")
    .max(500, "El comentario es muy largo")
    .trim(),
});
