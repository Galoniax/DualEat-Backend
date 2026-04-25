import { Router } from "express";
import passport from "passport";

import { AuthController } from "../controllers/auth.controller";
import { UserService } from "../services/user.service";

import { PasswordService } from "../services/password.service";
import { PasswordController } from "../controllers/password.controller";

import { limiter } from "../../../core/middlewares/rateLimiter";
import { isAuthenticated } from "../../../core/middlewares/isAuthenticated";

import { createTempToken, createSecureToken } from "../../../shared/utils/jwt";
import {
  UserSessionData,
  TempTokenPayload,
} from "../../../shared/interfaces/dto/user.dto";
import { prisma } from "../../../core/database/prisma/prisma";

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
      const tempToken = createTempToken(tempTokenPayload);

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
            } as any
          }
        }
      });

      if (user.isBusiness) {
        const hasPendingLocal = workplaces.some(w => !((w as any).local?.active));
        if (hasPendingLocal) {
          return res.redirect(`${process.env.FRONTEND_URL}/login?error=local_pending`);
        }
      }

      const workplaceData = workplaces.map(workplace => ({
        id: (workplace as any).local.id,
        slug: (workplace as any).local.slug,
        name: (workplace as any).local.name,
        role: workplace.role
      }));

      const userData: UserSessionData = {
        id: user.id,
        name: user.name,
        email: user.email,
        slug: user.slug,
        role: user.role,
        provider: user.provider,
        isBusiness: user.isBusiness,
        active: user.active,
        verified: user.verified,
        subscription_status: user.subscription_status,
        trial_ends_at: user.trial_ends_at,
        avatar_url: user.avatar_url,

        workplaces: workplaceData,
        loginAt: new Date(),
        lastActivity: new Date(),
        deviceId: deviceID,
      };

      // ============ Lógica de autenticación =============
      const accessToken = await createSecureToken(userData, true, deviceID);

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: isMobile ? 14 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
      });

      // ============ Lógica de redirección =============
      if (isMobile) {
        console.log("Redirigiendo a dualeat://callback?token=" + accessToken);
        return res.redirect(`dualeat://callback?token=${accessToken}`);
      } else {
        if (user.isBusiness) {
          if (user.subscription_status === "active") {
            return res.redirect(`${process.env.FRONTEND_URL}/business/dashboard`);
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
router.get("/me", isAuthenticated, (req, res) => {
  res.json(req.user);
});

// 4. RUTAS DE LOGOUT
// =========================================
router.post("/logout", controller.logout.bind(controller));

export default router;
