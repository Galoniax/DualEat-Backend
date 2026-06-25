import { z } from "zod";

export const updateProfileSchema = z
  .object({
    name: z.string().min(1, "El nombre no puede estar vacío").trim().optional(),
    avatar_url: z
      .url("El avatar debe ser una URL válida")
      .nullable()
      .optional(),
    currentPassword: z
      .string()
      .min(6, "La contraseña actual debe tener al menos 6 caracteres")
      .optional(),
    newPassword: z
      .string()
      .min(6, "La nueva contraseña debe tener al menos 6 caracteres")
      .optional(),
  })
  .refine(
    (data) => {
      if (data.newPassword && !data.currentPassword) {
        return false;
      }
      return true;
    },
    {
      message: "Debes ingresar tu contraseña actual para establecer una nueva",
      path: ["currentPassword"],
    },
  )
  .refine(
    (data) => {
      return (
        data.name !== undefined ||
        data.avatar_url !== undefined ||
        data.newPassword !== undefined
      );
    },
    {
      message: "No hay datos para actualizar",
    },
  );
