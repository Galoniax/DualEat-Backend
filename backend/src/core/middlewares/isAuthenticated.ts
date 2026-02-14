import { verifyAccessToken } from "../../shared/utils/jwt";
import AuthSessionService from "../../modules/auth/services/auth-session.service";

import { Request, Response, NextFunction } from "express";

const authSessionService = AuthSessionService.getInstance();

export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let token = req.cookies.accessToken;

  if (!token && req.headers.authorization) {
    const header = req.headers.authorization;

    if (header.startsWith("Bearer ")) {
      token = header.substring(7);
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token no encontrado",
    });
  }

  try {
    // 1. Verificar JWT
    const payload = verifyAccessToken(token);

    // Verificar que sea un access token
    if (payload.typ !== "access") {
      return res.status(401).json({
        success: false,
        message: "Tipo de token inválido",
      });
    }

    // 2. Obtener datos de sesión de Redis
    const userData = await authSessionService.getSession(
      payload.ses,
      payload.dev,
      payload.rem,
    );

    if (!userData) {
      return res.status(401).clearCookie("accessToken").json({
        success: false,
        message: "Sesión expirada",
      });
    }

    // 3. Verificar que el usuario siga activo
    if (!userData.active) {
      await authSessionService.deleteSession(payload.ses);

      return res.status(401).clearCookie("accessToken").json({
        success: false,
        message: "Cuenta desactivada",
      });
    }

    // 4. Adjuntar datos de usuario al request
    req.user = userData;

    next();
  } catch (e: any) {
    return res.status(401).clearCookie("accessToken").json({
      success: false,
      message: "Token inválido o expirado",
    });
  }
};