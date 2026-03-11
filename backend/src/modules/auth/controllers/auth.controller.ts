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
  SecureTokenPayload,
} from "../../../shared/interfaces/user.dto";

import { comparePassword, hashPassword } from "../../../shared/utils/hash";

import {
  createSecureToken,
  createTempToken,
  verifyTempToken,
} from "../../../shared/utils/jwt";
import AuthSessionService from "../services/auth-session.service";
import { generateUniqueSlug } from "../../../shared/utils/sluglify";

export class AuthController {
  private readonly authSessionService = AuthSessionService.getInstance();

  constructor(private userService: UserService) {}

  // =========================================================
  // INICIO DE SESIÓN
  // =========================================================
  async login(req: Request, res: Response) {
    try {
      const { email, password, remember, recaptcha, deviceId } = req.body;

      const params = new URLSearchParams();
  
      params.append("secret", process.env.RECAPTCHA_CLOUDFARE_SECRET_KEY || "");
      params.append("response", recaptcha);

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email y contraseña son obligatorios",
        });
      }

      if (!deviceId) {
        return res.status(400).json({
          success: false,
          message: "Device ID es obligatorio para la autenticación",
        });
      }

      // ============================================================
      // 2. VERIFICACIÓN DE SEGURIDAD (RECAPTCHA)
      // ============================================================
      if (!recaptcha) {
        return res.status(400).json({
          success: false,
          message: "reCAPTCHA no proporcionado",
        });
      }

      const reCAPTCHA_Response = await axios.post(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        params.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      if (!reCAPTCHA_Response.data.success) {
        return res.status(403).json({
          success: false,
          message: "Fallo en la verificación reCAPTCHA. Inténtalo de nuevo.",
        });
      }

      // ============================================================
      // 3. VERIFICACIÓN DE CREDENCIALES (DB)
      // ============================================================
      const user = await this.userService.getByEmail(email);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Credenciales incorrectas",
        });
      }

      const passwordMatch = await comparePassword(
        password,
        user.password_hash || "",
      );

      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          message: "Credenciales incorrectas",
        });
      }

      // ============================================================
      // 4. PREPARACIÓN DE DATOS DE SESIÓN
      // ============================================================
      const userData: UserSessionData = {
        id: user.id,
        name: user.name,
        email: user.email,
        slug: user.slug,
        role: user.role,
        provider: user.provider,
        isBusiness: user.is_business,
        active: user.active,
        verified: user.verified,
        subscription_status: user.subscription_status,
        trial_ends_at: user.trial_ends_at,
        avatar_url: user.avatar_url ?? null,
        workplaces: user.workplaces || [],

        loginAt: new Date(),
        lastActivity: new Date(),
        deviceId: deviceId,
      };

      // ============================================================
      // 5. GENERACIÓN DE TOKEN Y COOKIE
      // ============================================================

      // Crear Token
      const accessToken = await createSecureToken(
        userData,
        remember || false,
        deviceId,
      );

      const cookieMaxAge = remember
        ? 14 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;

      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        sameSite: "strict" as const,
        maxAge: cookieMaxAge,
      };

      console.log(
        `Login exitoso. User: ${email}, Device: ${deviceId}, Remember: ${remember}`,
      );

      // ============================================================
      // 6. RESPUESTA FINAL
      // ============================================================
      return res
        .cookie("accessToken", accessToken, cookieOptions)
        .status(200)
        .json({
          success: true,
          message: "Login exitoso",
          token: accessToken,
          user: userData,
        });
    } catch (e) {
      console.error("Login error:", e);
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  }
  // =========================================================
  // REGISTRO INICIAL
  // =========================================================
  async register(req: Request, res: Response) {
    try {
      // ==================== VALIDACIÓN DE INPUTS =====================
      const { email, password, deviceId } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email y contraseña son obligatorios",
        });
      }

      if (!deviceId) {
        return res.status(400).json({
          success: false,
          message: "Device ID es obligatorio para el registro",
        });
      }

      const eUser = await this.userService.getByEmail(email);
      if (eUser) {
        return res.status(409).json({
          success: false,
          message: "El usuario ya existe con este correo",
        });
      }

      // ============================================================
      // 3. PROCESAMIENTO Y TOKEN TEMPORAL
      // ============================================================

      // Hash de la contraseña
      const hashedPassword = await hashPassword(password);

      // Crear token temporal
      const ttp: TempTokenPayload = {
        email,
        password_hash: hashedPassword,
        step: "incomplete_registration",
        provider: "local",
        dev: deviceId,
      };

      const tempToken = createTempToken(ttp);

      return res.status(200).json({
        success: true,
        message: "Credenciales válidas. Continuando a preferencias.",
        //next_step: `/onboarding?tempToken=${tempToken}`,
        next_step: `?tempToken=${tempToken}`,
      });
    } catch (error) {
      console.error("Register Error:", error);
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  }

  // =========================================================
  // COMPLETAR PERFIL Y CREAR USUARIO
  // =========================================================
  async completeProfile(req: Request, res: Response) {
    try {
      // ==================== EXTRACCIÓN =====================
      const { name, foodPreferences, communityPreferences, tempToken } =
        req.body as RegisterStepTwoDto & { tempToken: string };

      if (!tempToken) {
        return res.status(401).json({
          success: false,
          message: "Token de registro no proporcionado",
        });
      }

      let tempData: TempTokenPayload;
      try {
        tempData = verifyTempToken(tempToken);
      } catch (err) {
        return res.status(401).json({
          success: false,
          message:
            "La sesión de registro ha expirado. Por favor inicia de nuevo.",
        });
      }

      // ============================================================
      // 2. PREPARACIÓN DE DATOS DEL USUARIO
      // ============================================================
      const model = prisma.user;

      // Generar Slug único
      const userSlug = await generateUniqueSlug(name.trim(), model);

      // URL de Avatar por defecto
      const DEFAULT_AVATAR =
        "https://ohhvldagwoycuifwhgtc.supabase.co/storage/v1/object/public/assets/DefaultProfile.png";

      const userDataToCreate: BasicCreateDTO = {
        email: tempData.email,
        name: name.trim(),
        slug: String(userSlug),
        password_hash: tempData.password_hash || undefined,
        avatar_url: tempData.avatar_url || DEFAULT_AVATAR,
        provider: tempData.provider || "local",
        foodPreferences,
        communityPreferences,
      };

      // ============================================================
      // 3. CREACIÓN EN BASE DE DATOS
      // ============================================================
      const user = await this.userService.create(userDataToCreate);

      if (!user) {
        throw new Error("Error al crear el usuario en la base de datos");
      }

      // ============================================================
      // 4. INICIO DE SESIÓN AUTOMÁTICO
      // ============================================================

      // Recuperamos el DeviceID
      const deviceId = tempData.dev || "unknown_device";

      const userSessionData: UserSessionData = {
        id: user.id,
        name: user.name,
        email: user.email,
        slug: user.slug,
        role: user.role,
        provider: user.provider,
        isBusiness: user.is_business,
        active: user.active,
        workplaces: [],
        verified: user.verified,
        subscription_status: user.subscription_status,
        trial_ends_at: user.trial_ends_at,
        avatar_url: user.avatar_url,

        loginAt: new Date(),
        lastActivity: new Date(),
        deviceId: deviceId,
      };

      // Crear Token Definitivo
      const accessToken = await createSecureToken(
        userSessionData,
        true,
        deviceId,
      );

      // ============================================================
      // 5. RESPUESTA UNIFICADA
      // ============================================================
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        sameSite: "strict" as const,
        maxAge: 14 * 24 * 60 * 60 * 1000,
      };

      return res
        .cookie("accessToken", accessToken, cookieOptions)
        .status(201)
        .json({
          success: true,
          message: "Registro completado exitosamente",
          user: userSessionData,
          token: accessToken,
        });
    } catch (e) {
      console.error("Error al completar el perfil:", e);
      return res.status(500).json({
        success: false,
        message: "Error interno al completar el perfil",
      });
    }
  }

  // =========================================================
  // LOGOUT
  // =========================================================
  async logout(req: Request, res: Response) {
    try {
      let token = req.cookies.accessToken;

      if (!token && req.headers.authorization) {
        const header = req.headers.authorization;
        if (header.startsWith("Bearer ")) {
          token = header.substring(7, header.length);
        }
      }

      if (token) {
        try {
          const decoded = jwt.verify(token, SECRET_KEY, {
            ignoreExpiration: true,
          }) as SecureTokenPayload;
          const sessionId = decoded.ses;

          if (sessionId) {
            await this.authSessionService.deleteSession(sessionId);
            console.log(`Sesión eliminada en logout: ${sessionId}`);
          }
        } catch (jwtError) {
          console.log(
            "Token inválido o corrupto en logout, ignorando limpieza de Redis.",
          );
        }
      }

      res.clearCookie("accessToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });

      return res.status(200).json({
        success: true,
        message: "Sesión cerrada exitosamente",
      });
    } catch (e) {
      console.error("Error en logout:", e);
      return res.status(200).json({
        success: true,
        message: "Sesión cerrada",
      });
    }
  }
}
