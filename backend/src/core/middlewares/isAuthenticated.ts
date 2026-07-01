import { verifyAccessToken } from "@/shared/utils/jwt";
import AuthSessionService from "@/modules/auth/services/auth-session.service";
import { Request, Response, NextFunction } from "express";
import { prisma } from "@/core/database/prisma/prisma";
import { UserSessionData } from "@/shared/interfaces/dto/user.dto";
import { DEFAULT_AVATAR } from "@/core/config/config";

const authSessionService = AuthSessionService.getInstance();

export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let token = req.cookies.accessToken;

    if (!token && req.headers.authorization) {
      const header = req.headers.authorization;

      if (header.startsWith("Bearer ")) {
        token = header.substring(7);
      }
    }

    if (!token) {
      throw new Error("Token no encontrado");
    }

    // 1. Verificar JWT
    const payload = verifyAccessToken(token);

    // Verificar que sea un access token
    if (payload.typ !== "access") {
      throw new Error("Tipo de token inválido");
    }

    // 2. Obtener datos de sesión de Redis
    const sessionMetadata = await authSessionService.getSession(
      payload.ses,
      payload.dev,
      payload.rem,
    );

    if (!sessionMetadata) {
      throw new Error("Sesión expirada");
    }

    // 3. Consultar base de datos en tiempo real para obtener el perfil completo y actualizado
    const user = await prisma.user.findUnique({
      where: { id: sessionMetadata.id },
      include: {
        local_users: {
          include: {
            local: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    // 4. Verificar que el usuario siga activo en la base de datos
    if (!user.active) {
      await authSessionService.deleteSession(payload.ses);
      throw new Error("Cuenta desactivada");
    }

    // 5. Estructurar workplaces
    const workplaceData = user.local_users.map((workplace) => ({
      id: workplace.local.id,
      slug: workplace.local.slug,
      name: workplace.local.name,
      role: workplace.role,
    }));

    // 6. Mapear al formato UserSessionData que esperan los controladores
    const userData: UserSessionData = {
      id: user.id,
      name: user.name,
      email: user.email,
      slug: user.slug,
      role: user.role,
      provider: user.provider,
      is_business: user.is_business,
      active: user.active,
      verified: user.verified,
      subscription_status: user.subscription_status,
      trial_ends_at: user.trial_ends_at,
      avatar_url: user.avatar_url ?? DEFAULT_AVATAR,
      notificationsPref: user.notificationsPref,

      workplaces: workplaceData,

      created_at: user.created_at,
      updated_at: user.updated_at,

      deviceId: sessionMetadata.deviceId,
    };

    // 7. Adjuntar datos al request
    req.user = userData;
    req.sessionId = payload.ses;

    next();
  } catch (e: any) {
    return res
      .status(401)
      .clearCookie("accessToken")
      .json({
        success: false,
        message: e.message || "Token inválido o expirado",
      });
  }
};
