import { z } from "zod";

export const createReviewSchema = z.object({
  review: z.object({
    rating: z
      .number()
      .int("El rating debe ser un entero")
      .positive("El rating debe ser positivo")
      .min(1, "El rating no puede ser menor a 1")
      .max(5, "El rating no puede ser mayor a 5"),
    comment: z
      .string()
      .max(300, "El comentario debe tener menos de 300 caracteres")
      .trim()
      .optional(),
    order_id: z.coerce.string().nonempty("El ID de la orden es requerido"),
    votes: z
      .array(
        z.object({
          id: z.coerce.string().nonempty("El ID es requerido"),
          type: z.enum(["UP", "DOWN"]),
        }),
      )
      .optional(),
  }),
});

export const updateReviewSchema = z.object({
  review: z.object({
    rating: z
      .number()
      .int("El rating debe ser un entero")
      .positive("El rating debe ser positivo")
      .min(1, "El rating no puede ser menor a 1")
      .max(5, "El rating no puede ser mayor a 5"),
    comment: z
      .string()
      .max(300, "El comentario debe tener menos de 300 caracteres")
      .trim(),
    order_id: z.coerce.string().nonempty("El ID de la orden es requerido"),
  }),
});
