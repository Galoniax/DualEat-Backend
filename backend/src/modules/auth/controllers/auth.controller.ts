import { UserService } from "../services/user.service";
import { Request, Response } from "express";
import { DEFAULT_AVATAR, SECRET_KEY } from "@/core/config/config";

import { prisma } from "@/core/database/prisma/prisma";

import jwt from "jsonwebtoken";

import {
  RegisterStepTwoDto,
  BasicCreateDTO,
  UserSessionData,
  TempTokenPayload,
  SecureTokenPayload,
} from "@/shared/interfaces/dto/user.dto";

import { comparePassword, hashPassword } from "@/shared/utils/hash";

import {
  createSecureToken,
  signAccessToken,
  verifyTempToken,
} from "@/shared/utils/jwt";
import AuthSessionService from "../services/auth-session.service";
import { generateSlug, generateUniqueSlug } from "@/shared/utils/sluglify";
import { optimize } from "@/shared/utils/sharp";
import { deleteFiles, uploadFiles } from "@/core/config/supabase";
import { Local, Role } from "@prisma/client";

export class AuthController {
  private readonly authSessionService = AuthSessionService.getInstance();

  constructor(private userService: UserService) {}

  // INICIO DE SESIÓN
  // =========================================================
  login = async (req: Request, res: Response) => {
    try {
      const { email, password, remember, token, deviceId, platform } = req.body;

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

      // 2. VERIFICACIÓN DE SEGURIDAD (RECAPTCHA)
      // ============================================================
      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Token no proporcionado",
        });
      }

      try {
        const form = new FormData();
        form.append(
          "secret",
          process.env.RECAPTCHA_CLOUDFARE_SECRET_KEY! ||
            "1x0000000000000000000000000000000AA",
        );
        form.append("response", token);

        const cfResponse = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            body: form,
          },
        );

        const cfData = await cfResponse.json();

        if (!cfData.success) {
          return res.status(403).json({
            success: false,
            message: "Fallo en la verificación de seguridad reCAPTCHA.",
          });
        }
      } catch (e) {
        return res.status(500).json({
          success: false,
          message:
            "Error de conexión con el servidor de verificación. Inténtalo más tarde.",
        });
      }

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

      // 4. RESTRICCIÓN DE PERSONAL (STAFF) EN WEB
      // ============================================================
      if (platform !== "mobile") {
        const localUserAssociations = await prisma.localUser.findMany({
          where: { user_id: user.id },
        });

        const hasStaffRole = localUserAssociations.some(
          (lu) => lu.role === "staff",
        );
        const hasAdminRole = localUserAssociations.some(
          (lu) => lu.role === "admin",
        );
        const isOwner = user.is_business;
        const isSuperAdmin = user.role === Role.ADMIN;

        if (hasStaffRole && !hasAdminRole && !isOwner && !isSuperAdmin) {
          return res.status(403).json({
            success: false,
            message:
              "Esta cuenta está asignada como personal de un local y solo puede acceder desde la aplicación móvil.",
          });
        }
      }

      if (user.is_business) {
        const userLocals = await prisma.localUser.findMany({
          where: { user_id: user.id },
          include: { local: true },
        });

        const hasPendingLocal = userLocals.some(
          (lw) => (lw.local as Local) && !lw.local.active,
        );

        if (hasPendingLocal) {
          return res.status(403).json({
            success: false,
            message:
              "Su comercio se encuentra en revisión. Por favor espere a que sea aprobado por un administrador para poder iniciar sesión.",
          });
        }
      }

      // 4. PREPARACIÓN DE DATOS DE SESIÓN
      // ============================================================
      const session: Pick<
        UserSessionData,
        "id" | "role" | "provider" | "deviceId" | "loginAt" | "lastActivity"
      > = {
        id: user.id,
        role: user.role,
        provider: user.provider,
        deviceId: deviceId,
        loginAt: new Date(),
        lastActivity: new Date(),
      };

      // 5. GENERACIÓN DE TOKEN Y COOKIE
      // ============================================================

      // Crear Token
      const accessToken = await createSecureToken(
        session,
        remember || false,
        deviceId,
      );

      const cookieMaxAge = remember
        ? 7 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;

      const isProd = process.env.NODE_ENV === "production";
      const cookieOptions = {
        httpOnly: true,
        secure: isProd,
        path: "/",
        sameSite: isProd ? "none" as const : "lax" as const,
        maxAge: cookieMaxAge,
      };

      console.log(
        `Login exitoso. User: ${email}, Device: ${deviceId}, Remember: ${remember}`,
      );

      const { password_hash, reset_code, ...data } = user;

      // 6. RESPUESTA FINAL
      // ============================================================
      return res
        .cookie("accessToken", accessToken, cookieOptions)
        .status(200)
        .json({
          success: true,
          message: "Login exitoso",
          token: accessToken,
          user: data,
        });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error interno del servidor",
      });
    }
  };

  // REGISTRO INICIAL
  // =========================================================
  register = async (req: Request, res: Response) => {
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

      // 3. PROCESAMIENTO Y TOKEN TEMPORAL
      // ============================================================
      const hashedPassword = await hashPassword(password);

      const ttp: TempTokenPayload = {
        email,
        password_hash: hashedPassword,
        step: "incomplete_registration",
        provider: "local",
        dev: deviceId,
      };

      const tempToken = signAccessToken(ttp, true);

      return res.status(200).json({
        success: true,
        message: "Credenciales válidas. Continuando a preferencias.",
        token: tempToken,
      });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  };

  // COMPLETAR PERFIL Y CREAR USUARIO
  // =========================================================
  completeProfile = async (req: Request, res: Response) => {
    try {
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

      // 2. PREPARACIÓN DE DATOS DEL USUARIO
      const slug = generateSlug(name.trim());

      const userDataToCreate: BasicCreateDTO = {
        email: tempData.email,
        name: name.trim(),
        slug: slug,
        password_hash: tempData.password_hash || undefined,
        avatar_url: tempData.avatar_url || DEFAULT_AVATAR,
        provider: tempData.provider || "local",
        foodPreferences,
        communityPreferences,
      };

      // 3. CREACIÓN EN BASE DE DATOS
      // ============================================================
      const user = await this.userService.create(userDataToCreate);

      if (!user) {
        throw new Error("Error al crear el usuario en la base de datos");
      }

      const deviceId = tempData.dev || "unknown_device";

      const session: Pick<
        UserSessionData,
        "id" | "role" | "provider" | "deviceId" | "loginAt" | "lastActivity"
      > = {
        id: user.id,
        role: user.role,
        provider: user.provider,
        deviceId: deviceId,
        loginAt: new Date(),
        lastActivity: new Date(),
      };

      const accessToken = await createSecureToken(session, true, deviceId);

      // 5. RESPUESTA UNIFICADA
      // ============================================================
      const isProd = process.env.NODE_ENV === "production";
      const cookieOptions = {
        httpOnly: true,
        secure: isProd,
        path: "/",
        sameSite: isProd ? "none" as const : "lax" as const,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      };

      const { password_hash, reset_code, ...data } = user;

      return res
        .cookie("accessToken", accessToken, cookieOptions)
        .status(201)
        .json({
          success: true,
          message: "Registro completado exitosamente",
          user: data,
          token: accessToken,
        });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error interno al completar el perfil",
      });
    }
  };

  // COMPLETAR PERFIL (LOCAL + USUARIO ADMIN)
  // =========================================================
  completeLocalProfile = async (req: Request, res: Response) => {
    try {
      const {
        tempToken,
        userName,
        localName,
        localAddress,
        localDescription,
        localType,
      } = req.body;

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

      const DEFAULT_AVATAR =
        "https://ohhvldagwoycuifwhgtc.supabase.co/storage/v1/object/public/assets/DefaultProfile.png";
      const userSlugString = String(
        await generateUniqueSlug(userName.trim(), prisma.user),
      );
      const localSlugString = String(
        await generateUniqueSlug(localName.trim(), prisma.local),
      );

      // START TRANSACTION
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create User
        const user = await tx.user.create({
          data: {
            email: tempData.email,
            name: userName.trim(),
            slug: userSlugString,
            password_hash: tempData.password_hash || undefined,
            avatar_url: tempData.avatar_url || DEFAULT_AVATAR,
            provider: tempData.provider || "local",
            is_business: true,
            role: "USER",
          },
        });

        // 2. Create Local
        const local = await tx.local.create({
          data: {
            slug: localSlugString,
            name: localName.trim(),
            address: localAddress.trim(),
            description: localDescription?.trim() || null,
            type_local: localType?.trim() || "Restaurante",
            image_url:
              "https://ohhvldagwoycuifwhgtc.supabase.co/storage/v1/object/public/assets/DefaultLocal.webp",
            latitude: 0,
            longitude: 0,
          },
        });

        // 3. Create LocalUser (link)
        await tx.localUser.create({
          data: {
            user_id: user.id,
            local_id: local.id,
            role: "admin",
          },
        });

        return { user, local };
      });

      return res.status(201).json({
        success: true,
        message: "Registro de local completado exitosamente y en revisión",
      });
    } catch (e) {
      console.error("Error al completar el perfil de local:", e);
      return res.status(500).json({
        success: false,
        message: "Error interno al completar el perfil de local",
      });
    }
  };

  // LOGOUT
  // =========================================================
  logout = async (req: Request, res: Response) => {
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

      const isProduction = process.env.NODE_ENV === "production";
      res.clearCookie("accessToken", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: "/",
      });

      return res.status(200).json({
        success: true,
        message: "Sesión cerrada exitosamente",
      });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: "Error al cerrar sesión",
      });
    }
  };

  // CERRAR TODAS LAS SESIONES
  // =========================================================
  logoutAll = async (req: Request, res: Response) => {
    try {
      const user_id = (req as any).user?.id;
      
      if (user_id) {
        await this.authSessionService.revokeAllUserSessions(user_id);
      }

      const isProduction = process.env.NODE_ENV === "production";
      res.clearCookie("accessToken", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: "/",
      });

      return res.status(200).json({
        success: true,
        message: "Todas las sesiones cerradas exitosamente",
      });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: "Error al cerrar todas las sesiones",
      });
    }
  };

  // OBTENER USUARIO POR ID
  // =========================================================
  getById = async (req: Request, res: Response) => {
    try {
      const { user_id } = req.params;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          message: "ID de usuario no proporcionado",
        });
      }

      const user = await this.userService.getById(String(user_id));

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      const { password_hash, reset_code, ...data } = user;

      return res.status(200).json({
        success: true,
        data: data,
      });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error interno en el servidor",
      });
    }
  };

  // OBTENER POSTS, RECETAS, COMMENTARIOS, RESEÑAS DE UN USUARIO
  // =========================================================
  getUserSearch = async (req: Request, res: Response) => {
    const { user_id } = req.params;

    const { query, tab, page } = req.query as {
      query?: string;
      tab: "posts" | "recipes" | "comments" | "reviews";
      page: string;
    };

    if (typeof page !== "string" || isNaN(Number(page))) {
      return res.status(400).json({
        success: false,
        message: "El número de página no es válido.",
      });
    }

    if (!tab || !user_id) {
      return res.status(400).json({
        success: false,
        message: "Datos invalidos",
      });
    }

    const searchQuery = query ? String(query) : "";

    const result = await this.userService.getUserSearch(
      searchQuery,
      tab,
      Number(page),
      String(user_id),
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  };

  // ACTUALIZAR PERFIL (STAFF / USER)
  // =========================================================
  update = async (req: Request, res: Response) => {
    const {
      name,
      avatar_url,
      currentPassword,
      newPassword,
      foodPreferences,
      communityPreferences,
    } = req.body;

    const user_id = (req as any).user?.id || req.body.user_id;
    try {
      if (!user_id) {
        return res
          .status(401)
          .json({ success: false, message: "No autorizado" });
      }

      const updateData: any = {};

      if (name !== undefined) {
        updateData.name = name;
      }

      if (avatar_url !== undefined) {
        updateData.avatar_url = avatar_url;
      }

      if (foodPreferences !== undefined) {
        updateData.foodPreferences = foodPreferences;
      }

      if (communityPreferences !== undefined) {
        updateData.communityPreferences = communityPreferences;
      }

      if (newPassword !== undefined && currentPassword !== undefined) {
        const user = await this.userService.getById(user_id);
        if (!user || !user.password_hash) {
          return res.status(400).json({
            success: false,
            message: "No se puede actualizar la contraseña de esta cuenta",
          });
        }

        const passwordMatch = await comparePassword(
          currentPassword!,
          user.password_hash,
        );
        if (!passwordMatch) {
          return res.status(400).json({
            success: false,
            message: "La contraseña actual es incorrecta",
          });
        }
        updateData.password_hash = await hashPassword(newPassword);
      }
      const updatedUser = await this.userService.update(user_id, updateData);
      const { password_hash, reset_code, ...safeUser } = updatedUser;

      return res.status(200).json({
        success: true,
        message: "Perfil actualizado correctamente",
        data: safeUser,
      });
    } catch (e: any) {
      if (avatar_url !== undefined) {
        deleteFiles([avatar_url]).catch((err) =>
          console.error("Error crítico al borrar imágenes huérfanas:", err),
        );
      }
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Error interno del servidor",
      });
    }
  };

  // SUBIR IMÁGENES
  // =========================================================
  upload = async (req: Request, res: Response) => {
    const user_id = (req as any).user?.id || req.body.user_id;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files || Object.keys(files).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No se recibieron archivos." });
    }

    try {
      const user = await this.userService.getById(user_id);
      let url: string = "";

      const promises: Promise<any>[] = [];

      if (user?.avatar_url && !user.avatar_url.includes("DefaultProfile.png")) {
        promises.push(
          deleteFiles([user.avatar_url]).catch((err) =>
            console.error("Error crítico al borrar imágenes huérfanas:", err),
          ),
        );
      }

      if (files["avatar_url"] && files["avatar_url"].length > 0) {
        promises.push(
          (async () => {
            const optimized = await optimize(files["avatar_url"]);
            url = (await uploadFiles(optimized[0], "profile", "")) as string;
          })(),
        );
      }

      await Promise.all(promises);

      return res.status(200).json({
        success: true,
        message: "Imagen subida correctamente",
        urls: url,
      });
    } catch (e: any) {
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Error interno al subir las imágenes.",
      });
    }
  };
}
