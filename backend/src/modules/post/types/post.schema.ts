import { z } from "zod";
import sanitizeHtml from "sanitize-html";

const sanitizeContent = (val: string) =>
  sanitizeHtml(val, {
    allowedTags: ["b", "em", "strong", "p", "h1", "h2", "ul", "ol", "li"],
  });

export const createPostSchema = z.object({
  post: z.object({
    title: z
      .string()
      .min(1, "El título es requerido")
      .trim(),
    content: z
      .string()
      .min(1, "El contenido es requerido")
      .transform(sanitizeContent),
    image_urls: z
      .array(z.url("Cada imagen debe ser una URL válida"))
      .optional(),
    community_id: z.string().nonempty("La comunidad es requerida"),
  }),
  recipe: z
    .object({
      name: z.string().min(1, "El nombre de la receta es requerido").trim(),
      description: z.string().min(1, "La descripción es requerida").trim(),
      main_image: z.url("La imagen debe ser una URL válida"),
      total_time: z.coerce
        .number()
        .positive("El tiempo total debe ser positivo")
        .optional(),
      steps: z.array(
        z.object({
          step_number: z.coerce
            .number()
            .int()
            .positive("El número de paso debe ser positivo"),
          description: z
            .string()
            .min(1, "La descripción del paso es requerida")
            .trim(),
          image_url: z.url("La imagen debe ser una URL válida").optional(),
          estimated_time: z.coerce
            .number()
            .int()
            .positive("El tiempo estimado debe ser positivo")
            .default(0),
        }),
      ),

      ingredients: z.array(
        z.object({
          ingredient_id: z.coerce
            .number()
            .int("El ID del ingrediente debe ser un entero"),
          quantity: z.string().trim(),
          unit: z.string(),
          notes: z.string().optional(),
        }),
      ),
    })
    .optional(),
});

export const updatePostSchema = z.object({
  post: z.object({
    id: z.coerce.string().nonempty("El ID del post es requerido"),
    title: z.string().min(1, "El título es requerido").trim(),
    content: z.string().min(1, "El contenido es requerido").transform(sanitizeContent),
    image_urls: z.array(z.url("Cada imagen debe ser una URL válida")).optional(),
    community_id: z.string().nonempty("La comunidad es requerida"),
  }),
});
