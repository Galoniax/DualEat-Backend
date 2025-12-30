import { verifyAccessToken } from "../utils/jwt";
import AuthSessionService from "../modules/auth/services/auth-session.service";
import { Request, Response, NextFunction } from "express";

const authSessionService = AuthSessionService.getInstance();

export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let token: string | null = null;
  let isMobile = false;

  console.log("🔍 Verificando autenticación del usuario...");

  // Obtener token desde Authorization header (MOBILE) o cookie (WEB)
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
    isMobile = true;
    console.log("📱 Token desde Authorization header (mobile)");
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
    isMobile = false;
    console.log("🌐 Token desde cookie (web)");
  }

  if (!token) {
    console.warn("🚫 Acceso denegado: token no presente");
    return res.status(401).json({ 
      success: false,
      message: "Token no encontrado" 
    });
  }

  try {
    // 1. Verificar JWT
    const payload = verifyAccessToken(token);

    // Verificar que sea un access token
    if (payload.typ !== "access") {
      console.warn("⚠️ Tipo de token inválido:", payload.typ);
      return res.status(401).json({
        success: false,
        message: "Tipo de token inválido",
      });
    }

    // 2. Obtener datos de sesión de Redis
    const userData = await authSessionService.getSession(
      payload.ses,
      payload.mob
    );

    if (!userData) {
      console.warn("⚠️ Sesión expirada:", payload.ses);
      
      if (isMobile) {
        return res.status(401).json({ 
          success: false,
          message: "Sesión expirada",
          requiresRefresh: true, // Indicar que debe usar refresh token
        });
      }
      
      return res
        .status(401)
        .clearCookie("accessToken")
        .json({ 
          success: false,
          message: "Sesión expirada",
          requiresRefresh: true,
        });
    }

    // 3. Verificar que el usuario siga activo
    if (!userData.active) {
      console.warn("⚠️ Usuario inactivo:", userData.id);
      await authSessionService.deleteSession(payload.ses);
      
      if (isMobile) {
        return res.status(401).json({ 
          success: false,
          message: "Usuario inactivo" 
        });
      }
      
      return res
        .status(401)
        .clearCookie("accessToken")
        .clearCookie("refreshToken")
        .json({ 
          success: false,
          message: "Usuario inactivo" 
        });
    }

    // 4. Adjuntar datos de usuario al request
    req.user = userData;

    console.log(`✅ Usuario autenticado: ${userData.email}`);
    next();
  } catch (err: any) {
    console.error("❌ Error de autenticación:", err.message);
    
    // Si el token expiró, indicar que debe refrescar
    const isExpired = err.name === "TokenExpiredError";
    
    if (isMobile) {
      return res.status(401).json({ 
        success: false,
        message: isExpired ? "Token expirado" : "Token inválido",
        requiresRefresh: isExpired,
      });
    }
    
    // Para web, limpiar solo el access token (mantener refresh)
    return res
      .status(401)
      .clearCookie("accessToken")
      .json({
        success: false,
        message: isExpired ? "Token expirado" : "Token inválido",
        requiresRefresh: isExpired,
      });
  }
};