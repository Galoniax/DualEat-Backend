import { Router } from "express";
import passport from "passport";

import { AuthController } from "../controllers/auth.controller";
import { UserService } from "../services/user.service";

import { PasswordService } from "../services/password.service";
import { PasswordController } from "../controllers/password.controller";

import { limiter } from "@/core/middlewares/rateLimiter";
import { isAuthenticated } from "@/core/middlewares/isAuthenticated";

import { createSecureToken, signAccessToken } from "@/shared/utils/jwt";
import {
  UserSessionData,
  TempTokenPayload,
} from "@/shared/interfaces/dto/user.dto";
import { prisma } from "@/core/database/prisma/prisma";
import { DEFAULT_AVATAR } from "@/core/config/config";
import multer from "multer";

const upload = multer({
  limits: { fileSize: 1024 * 1024 * 2 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de archivo no permitido"));
    }
  },
});

const router = Router();

const service = new UserService();
const controller = new AuthController(service);

const pservice = new PasswordService();
const pcontroller = new PasswordController(pservice);

// 0. RUTAS DE LOGIN CON GOOGLE
// =========================================
router.get("/google", (req, res, next) => {
  const deviceID = (req.query.deviceId as string) || "unknown_device";
  const platform = (req.query.platform as string) || "web";

  console.log(`Iniciando Google Login (${platform}) - Device: ${deviceID}`);

  const stateData = {
    platform,
    deviceID,
  };

  // Codificar a Base64 (URL Safe)
  const stateBase64 = Buffer.from(JSON.stringify(stateData)).toString("base64");

  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
    state: stateBase64,
  })(req, res, next);
});

// CALLBACK DE GOOGLE
// =========================================
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
  }),
  async (req, res) => {
    const user = req.user as any;

    const stateParam = req.query.state as string;
    let state = { platform: "web", deviceID: "unknown_device" };

    if (stateParam) {
      try {
        const jsonString = Buffer.from(stateParam, "base64").toString("utf-8");
        state = JSON.parse(jsonString);
      } catch (e) {
        console.error("Error parseando state de Google:", e);
      }
    }

    const deviceID = state.deviceID || "unknown_device";
    const isMobile = state.platform === "mobile";

    console.log(
      `Callback Google recibido. User: ${user.email}, Device: ${deviceID}`,
    );

    // ============ Lógica de Nuevo Usuario =============
    if (user && !user.isExisting) {
      const tempTokenPayload: TempTokenPayload = {
        email: user.email,
        avatar_url: user.avatar_url,
        provider: user.provider,
        dev: deviceID,
        step: "incomplete_oauth_registration",
      };
      const tempToken = signAccessToken(tempTokenPayload, true);

      if (isMobile) {
        return res.redirect(`dualeat://callback?tempToken=${tempToken}`);
      } else {
        return res.redirect(
          `${process.env.FRONTEND_URL}/onboarding?tempToken=${tempToken}`,
        );
      }
    } else if (user && user.isExisting) {
      // ============ Obtener Workplaces del usuario =============
      const workplaces = await prisma.localUser.findMany({
        where: { user_id: user.id },
        select: {
          role: true,
          local: {
            select: {
              id: true,
              slug: true,
              name: true,
              active: true,
            } as any,
          },
        },
      });

      if (user.is_business) {
        const hasPendingLocal = workplaces.some(
          (w) => !(w as any).local?.active,
        );
        if (hasPendingLocal) {
          return res.redirect(
            `${process.env.FRONTEND_URL}/login?error=local_pending`,
          );
        }
      }

      // ============================================================
      // RESTRICCIÓN DE PERSONAL (STAFF) EN WEB
      // ============================================================
      if (!isMobile) {
        const hasStaffRole = workplaces.some((w) => w.role === "staff");
        const hasAdminRole = workplaces.some((w) => w.role === "admin");
        const isOwner = user.isBusiness;
        const isSuperAdmin = user.role === "ADMIN";

        if (hasStaffRole && !hasAdminRole && !isOwner && !isSuperAdmin) {
          return res.redirect(
            `${process.env.FRONTEND_URL}/login?error=staff_restriction`,
          );
        }
      }

      const session: Pick<
        UserSessionData,
        "id" | "role" | "provider" | "deviceId" | "loginAt" | "lastActivity"
      > = {
        id: user.id,
        role: user.role,
        provider: user.provider,
        deviceId: deviceID,
        loginAt: new Date(),
        lastActivity: new Date(),
      };

      // ============ Lógica de autenticación =============
      const accessToken = await createSecureToken(session, true, deviceID);

      const isProd = process.env.NODE_ENV === "production";
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        path: "/",
        maxAge: isMobile ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
      });

      // ============ Lógica de redirección =============
      if (isMobile) {
        console.log("Redirigiendo a dualeat://callback?token=" + accessToken);
        return res.redirect(`dualeat://callback?token=${accessToken}`);
      } else {
        if (user.is_business) {
          if (user.subscription_status === "active") {
            return res.redirect(
              `${process.env.FRONTEND_URL}/business/dashboard`,
            );
          } else {
            return res.redirect(`${process.env.FRONTEND_URL}/business/menu`);
          }
        } else {
          return res.redirect(`${process.env.FRONTEND_URL}/feed`);
        }
      }
    } else {
      console.log("No se recibió usuario en req.user");
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=auth_failed`,
      );
    }
  },
);

// 1. RUTAS DE LOGIN/REGISTRO CON EMAIL Y CONTRASEÑA
// =========================================
router.post("/login", limiter(false), controller.login.bind(controller));

router.post("/register", limiter(false), controller.register.bind(controller));

router.post(
  "/complete-profile",
  limiter(false),
  controller.completeProfile.bind(controller),
);

router.post(
  "/complete-local-profile",
  limiter(false),
  controller.completeLocalProfile.bind(controller),
);

// 2. RUTAS DE RESET DE CONTRASEÑA
// =========================================
router.post(
  "/password_reset",
  limiter(false),
  pcontroller.requestReset.bind(pcontroller),
);

router.post(
  "/password_reset/validate-code",
  limiter(false),
  pcontroller.validateCode.bind(pcontroller),
);

router.post(
  "/password_reset/reset",
  limiter(false),
  pcontroller.reset.bind(pcontroller),
);

// 3. RUTAS DE USUARIO AUTENTICADO
// =========================================
router.post(
  "/upload",
  limiter(false),
  isAuthenticated,
  upload.fields([{ name: "avatar_url", maxCount: 1 }]),
  controller.upload.bind(controller),
);

router.get("/me", isAuthenticated, async (req, res) => {
  try {
    const user_id = (req as any).user?.id;

    const user = await prisma.user.findUnique({
      where: { id: user_id },
      include: {
        local_users: {
          include: {
            local: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    if (!user.active) {
      return res.status(403).json({ success: false, message: "Cuenta desactivada" });
    }

    const workplaces = user.local_users.map((workplace) => ({
      id: workplace.local.id,
      slug: workplace.local.slug,
      name: workplace.local.name,
      role: workplace.role,
    }));

    const { password_hash, local_users, ...safeUser } = user;

    res.json({
      ...safeUser,
      avatar_url: user.avatar_url ?? DEFAULT_AVATAR,
      workplaces,
      deviceId: (req as any).user?.deviceId,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: "Error al obtener perfil" });
  }
});

router.get("/:user_id", controller.getById.bind(controller));

router.get("/:user_id/search", controller.getUserSearch.bind(controller));

router.put(
  "/me",
  limiter(false),
  isAuthenticated,
  controller.update.bind(controller),
);

// 4. RUTAS DE LOGOUT
// =========================================
router.post("/logout", controller.logout.bind(controller));

router.post(
  "/logout-all",
  isAuthenticated,
  controller.logoutAll.bind(controller),
);

export default router;
