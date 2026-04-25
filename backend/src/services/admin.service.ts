import bcrypt from "bcryptjs";

import { generateUniqueSlug } from "../shared/utils/sluglify";

import { prisma } from "../core/database/prisma/prisma";

export const createBusinessUserAndLocal = async (
  userData: { name: string; email: string; password: string },
  _businessData: any, // Obsoleto, se mantiene por compatibilidad de firma si es necesario
  localData: any
) => {
  try {
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const userSlug = await generateUniqueSlug(userData.name.trim(), tx.user);
      const user = await tx.user.create({
        data: {
          name: userData.name,
          slug: userSlug,
          email: userData.email,
          password_hash: hashedPassword,
          is_business: true,
          role: "USER",
        },
      });

      const localSlug = await generateUniqueSlug(localData.name.trim(), tx.local);
      const local = await tx.local.create({
        data: {
          name: localData.name,
          slug: localSlug,
          description: localData.description || "",
          address: localData.address || "",
          phone: localData.phone || "",
          email: localData.email || userData.email,
          image_url: localData.image_url || "https://placehold.co/600x400/png?text=DualEat+Local",
          type_local: localData.type_local || "Restaurante",
          latitude: localData.latitude || -34.6037, // Default Buenos Aires
          longitude: localData.longitude || -58.3816,
        },
      });

      const localUser = await tx.localUser.create({
        data: {
          user_id: user.id,
          local_id: local.id,
          role: "admin",
        },
      });

      return { user, local, localUser };
    });

    return { success: true, ...result };
  } catch (error: any) {
    console.error("Error creating business user and local:", error);
    throw new Error(error.message || "Could not create business user and local.");
  }
};