import { UserService } from "../services/user.service";
import { Request, Response } from "express";
import { RECAPTCHA_SECRET_KEY, SECRET_KEY } from "../../../core/config/config";
import { prisma } from "../../../core/database/prisma/prisma";
import jwt from "jsonwebtoken";
import axios from "axios";

import {
  RegisterStepTwoDto,
  BasicCreateDTO,
  UserSessionData,
  TempTokenPayload,
} from "../../../shared/interfaces/user.dto";

import { comparePassword, hashPassword } from "../../../shared/utils/hash";

import {
  createTokenPair,
  createTempToken,
  verifyTempToken,
  verifyRefreshToken,
  hashTokenId,
  createAccessToken,
  createRefreshToken,
} from "../../../shared/utils/jwt";

import AuthSessionService from "../services/auth-session.service";
import { generateUniqueSlug } from "../../../shared/utils/sluglify";

export class AuthController {
  private readonly authSessionService = AuthSessionService.getInstance();

  constructor(private userService: UserService) {}

  login = async (req: Request, res: Response) => {
    const { email, password, rememberMe, recaptchaToken, isMobile } = req.body;

    try {
      // ===== reCAPTCHA =====
      if (!recaptchaToken) {
        return res.status(400).json({
          success: false,
          message: "reCAPTCHA no proporcionado",
        });
      }

      const recaptchaResponse = await axios.post(
        "https://www.google.com/recaptcha/api/siteverify",
        null,
        {
          params: {
            secret: RECAPTCHA_SECRET_KEY,
            response: recaptchaToken,
          },
        }
      );

      if (!recaptchaResponse.data.success) {
        return res.status(403).json({
          success: false,
          message: "Fallo en la verificación reCAPTCHA. Inténtalo de nuevo.",
        });
      }

      // ===== VERIFICACIÓN DE CREDENCIALES =====
      const user = await this.userService.getByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Credenciales incorrectas",
        });
      }

      const passwordMatch = await comparePassword(
        password,
        user.password_hash || ""
      );
      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          message: "Credenciales incorrectas",
        });
      }

      // ===== PREPARAR DATOS PARA SESIÓN =====
      const userData: UserSessionData = {
        id: user.id,
        name: user.name,
        email: user.email,
        slug: user.slug,
        role: user.role,
        provider: user.provider,
        isBusiness: user.is_business,
        active: user.active,
        subscription_status: user.subscription_status,
        trial_ends_at: user.trial_ends_at,
        avatar_url: user.avatar_url ?? null,
        loginAt: new Date(),
        lastActivity: new Date(),
      };

      // ===== CREAR PAR DE TOKENS (Access + Refresh) =====
      const { accessToken, refreshToken } = await createTokenPair(
        userData,
        rememberMe || false,
        isMobile || false
      );

      console.log(
        `🔐 Login exitoso para: ${email} (isMobile: ${isMobile}, rememberMe: ${rememberMe})`
      );

      // ===== MOBILE: Retornar tokens en el body =====
      if (isMobile) {
        return res.status(200).json({
          success: true,
          message: "Login exitoso",
          user: userData,
          accessToken,
          refreshToken,
        });
      }

      // ===== WEB: Configurar cookies seguras =====
      const accessCookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        sameSite: "strict" as const,
        maxAge: 15 * 60 * 1000, // 15 minutos
      };

      const refreshCookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/api/auth/refresh", // Solo accesible en el endpoint de refresh
        sameSite: "strict" as const,
        maxAge: rememberMe
          ? 7 * 24 * 60 * 60 * 1000 // 7 días
          : 24 * 60 * 60 * 1000, // 24 horas
      };

      return res
        .cookie("accessToken", accessToken, accessCookieOptions)
        .cookie("refreshToken", refreshToken, refreshCookieOptions)
        .status(200)
        .json({
          success: true,
          message: "Login exitoso",
          user: userData,
        });
    } catch (error) {
      console.error("❌ Login error:", error);
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  };

  refresh = async (req: Request, res: Response) => {
    try {
      let refreshToken: string | null = null;
      let isMobile = false;

      // Obtener refresh token desde header (mobile) o cookie (web)
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith("Bearer ")) {
        refreshToken = authHeader.substring(7);
        isMobile = true;
        console.log("📱 Refresh desde mobile");
      } else if (req.cookies?.refreshToken) {
        refreshToken = req.cookies.refreshToken;
        isMobile = false;
        console.log("🌐 Refresh desde web");
      }

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: "Refresh token no encontrado",
        });
      }

      // Verificar refresh token
      const payload = verifyRefreshToken(refreshToken);
      const sessionId = payload.ses;
      const jti = payload.jti;

      // Verificar que el refresh token no haya sido revocado
      const hashedJti = hashTokenId(jti);
      const isValid = await this.authSessionService.isRefreshTokenValid(
        sessionId,
        hashedJti
      );

      if (!isValid) {
        console.warn("⚠️ Refresh token inválido o revocado");
        return res.status(401).json({
          success: false,
          message: "Refresh token inválido o revocado",
        });
      }

      // Obtener datos de sesión
      const userData = await this.authSessionService.getSession(
        sessionId,
        isMobile
      );

      if (!userData) {
        console.warn("⚠️ Sesión expirada en refresh");
        return res.status(401).json({
          success: false,
          message: "Sesión expirada",
        });
      }

      // Verificar que el usuario siga activo
      if (!userData.active) {
        await this.authSessionService.deleteSession(sessionId);
        return res.status(401).json({
          success: false,
          message: "Usuario inactivo",
        });
      }

      // ROTACIÓN DE TOKENS:
      // 1. Revocar el refresh token actual
      await this.authSessionService.revokeRefreshToken(sessionId, hashedJti);

      // 2. Crear nuevo par de tokens
      const newAccessToken = await createAccessToken(
        userData,
        sessionId,
        isMobile
      );
      const newRefreshToken = await createRefreshToken(sessionId, isMobile);

      console.log(`🔄 Tokens renovados para sesión: ${sessionId}`);

      // Para mobile: retornar en el body
      if (isMobile) {
        return res.status(200).json({
          success: true,
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        });
      }

      // Para web: actualizar cookies
      const accessCookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        sameSite: "strict" as const,
        maxAge: 15 * 60 * 1000,
      };

      const refreshCookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/api/auth/refresh",
        sameSite: "strict" as const,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      };

      return res
        .cookie("accessToken", newAccessToken, accessCookieOptions)
        .cookie("refreshToken", newRefreshToken, refreshCookieOptions)
        .status(200)
        .json({
          success: true,
          message: "Tokens renovados",
        });
    } catch (error: any) {
      console.error("❌ Error en refresh:", error);

      // Distinguir entre token expirado y otros errores
      const isExpired = error.name === "TokenExpiredError";

      return res.status(401).json({
        success: false,
        message: isExpired
          ? "Refresh token expirado"
          : "Error renovando tokens",
      });
    }
  };

  register = async (req: Request, res: Response) => {
    const { email, password, isMobile } = req.body;

    console.log(isMobile ? "📱 Registro desde móvil" : "🌐 Registro desde web");

    try {
      const existingUser = await this.userService.getByEmail(email);
      if (existingUser) {
        return res
          .status(409)
          .json({ success: false, message: "El usuario ya existe" });
      }

      const hashedPassword = await hashPassword(password);

      const tempToken: string = createTempToken({
        email,
        password_hash: hashedPassword,
        step: "incomplete_registration",
        provider: "local",
        isMobile,
      });

      return res.status(200).json({
        success: true,
        message: "Trasladando a Preferencias",
        next_step: `/onboarding?tempToken=${tempToken}`,
      });
    } catch (error) {
      console.error("❌ Error en registro:", error);
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };

  completeProfile = async (req: Request, res: Response) => {
    const {
      name,
      foodPreferences,
      communityPreferences,
      tempToken,
    }: RegisterStepTwoDto & { tempToken: string } = req.body;

    console.log("✏️ Completando perfil");

    try {
      const model = prisma.user;
      if (!tempToken) {
        return res
          .status(401)
          .json({ message: "Token temporal no proporcionado" });
      }

      let tempData: TempTokenPayload;
      try {
        tempData = verifyTempToken(tempToken);
      } catch (err) {
        return res
          .status(401)
          .json({ message: "Token temporal inválido o expirado" });
      }

      if (
        tempData.step !== "incomplete_registration" &&
        tempData.step !== "incomplete_oauth_registration"
      ) {
        return res.status(401).json({ message: "Token temporal no válido" });
      }

      const userSlug = await generateUniqueSlug(name.trim(), model);

      const userDataToCreate: BasicCreateDTO = {
        email: tempData.email,
        name,
        slug: String(userSlug),
        password_hash: tempData.password_hash || undefined,
        avatar_url:
          tempData.avatar_url ||
          "https://ohhvldagwoycuifwhgtc.supabase.co/storage/v1/object/public/assets/DefaultProfile.png",
        provider: tempData.provider || "local",
        foodPreferences,
        communityPreferences,
      };

      const user = await this.userService.create(userDataToCreate);

      const userSessionData: UserSessionData = {
        id: user.id,
        name: user.name,
        email: user.email,
        slug: user.slug,
        role: user.role,
        provider: user.provider,
        isBusiness: user.is_business,
        active: user.active,
        subscription_status: user.subscription_status,
        trial_ends_at: user.trial_ends_at,
        avatar_url: user.avatar_url ?? null,
        loginAt: new Date(),
        lastActivity: new Date(),
      };

      const { accessToken, refreshToken } = await createTokenPair(
        userSessionData,
        true,
        tempData.isMobile || false
      );

      // Para mobile: retornar tokens
      if (tempData.isMobile) {
        return res.status(201).json({
          success: true,
          message: "Perfil completado exitosamente",
          user: userSessionData,
          accessToken,
          refreshToken,
        });
      }

      // Para web: cookies
      return res
        .cookie("accessToken", accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          path: "/",
          sameSite: "strict",
          maxAge: 15 * 60 * 1000,
        })
        .cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          path: "/api/auth/refresh",
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        })
        .status(201)
        .json({
          success: true,
          message: "Perfil completado exitosamente",
          user: userSessionData,
        });
    } catch (error) {
      console.error("❌ Error al completar perfil:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  logout = async (req: Request, res: Response) => {
    try {
      const token =
        req.cookies?.accessToken || req.headers.authorization?.substring(7);

      if (token) {
        try {
          const decoded = jwt.verify(token, SECRET_KEY) as any;
          const sessionId = decoded.ses;

          if (sessionId) {
            await this.authSessionService.deleteSession(sessionId);
            console.log(`🗑️ Sesión eliminada en logout: ${sessionId}`);
          }
        } catch (jwtError) {
          console.log("Token inválido en logout, solo limpiando cookies");
        }
      }

      // Limpiar ambas cookies
      res.clearCookie("accessToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });

      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/auth/refresh",
      });

      return res.status(200).json({
        success: true,
        message: "Sesión cerrada exitosamente",
      });
    } catch (error) {
      console.error("❌ Error en logout:", error);

      // Intentar limpiar cookies de todos modos
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");

      return res.status(200).json({
        success: true,
        message: "Sesión cerrada",
      });
    }
  };
}
