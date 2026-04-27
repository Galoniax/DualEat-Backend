import { prisma } from "../../../core/database/prisma/prisma";
import { hashPassword } from "../../../shared/utils/hash";
import { generateUniqueSlug } from "../../../shared/utils/sluglify";

export class EmployeeService {
  async listEmployees(localId: string) {
    return await prisma.localUser.findMany({
      where: {
        local_id: localId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar_url: true,
            role: true,
          },
        },
      },
      orderBy: {
        joined_at: "desc",
      },
    });
  }

  async addEmployee(localId: string, email: string, name?: string, password?: string) {
    // 1. Check if user exists
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // Check if already linked to this local
      const existingLink = await prisma.localUser.findUnique({
        where: {
          user_id_local_id: {
            user_id: user.id,
            local_id: localId,
          },
        },
      });

      if (existingLink) {
        throw new Error("El usuario ya está asignado a este local");
      }

      // Link as staff
      return await prisma.localUser.create({
        data: {
          user_id: user.id,
          local_id: localId,
          role: "staff",
        },
        include: {
          user: true,
        },
      });
    } else {
      // User doesn't exist, create it
      if (!name || !password) {
        throw new Error("El usuario no existe. Se requiere nombre y contraseña para crearlo.");
      }

      const hashedPassword = await hashPassword(password);
      const slug = await generateUniqueSlug(name, prisma.user);

      return await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            name,
            password_hash: hashedPassword,
            slug: String(slug),
            role: "USER",
            verified: true, // Auto-verify since created by local?
            is_business: false,
          },
        });

        return await tx.localUser.create({
          data: {
            user_id: newUser.id,
            local_id: localId,
            role: "staff",
          },
          include: {
            user: true,
          },
        });
      });
    }
  }

  async removeEmployee(localId: string, userId: string) {
    // Prevent removing the last admin? (Business logic)
    // For now, just remove the link.
    return await prisma.localUser.delete({
      where: {
        user_id_local_id: {
          user_id: userId,
          local_id: localId,
        },
      },
    });
  }
}
