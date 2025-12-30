import { Router } from "express";
import passport from "passport";

import { AuthController } from "../controllers/auth.controller";
import { UserService } from "../services/user.service";

import { PasswordService } from "../services/password.service";
import { PasswordController } from "../controllers/password.controller";

import { generalLimiter } from "../../../core/middlewares/rateLimiter";
import { isAuthenticated } from "../../../core/middlewares/isAuthenticated";

import { createTempToken, createTokenPair } from "../../../shared/utils/jwt";
import {
  UserSessionData,
  TempTokenPayload,
} from "../../../shared/interfaces/user.dto";

const router = Router();

const service = new UserService();
const controller = new AuthController(service);

const pservice = new PasswordService();
const pcontroller = new PasswordController(pservice);

// --- RUTAS DE AUTENTICACIÓN ---

// Login con email/password
router.post("/login", generalLimiter, controller.login.bind(controller));

// Registro paso 1
router.post("/register", generalLimiter, controller.register.bind(controller));

// Completar perfil (paso 2)
router.post(
  "/complete-profile",
  generalLimiter,
  controller.completeProfile.bind(controller)
);

// Endpoint para refrescar tokens
router.post("/refresh", generalLimiter, controller.refresh.bind(controller));

// Logout
router.post("/logout", controller.logout.bind(controller));

// Obtener usuario actual
router.get("/me", isAuthenticated, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

// --- GOOGLE OAUTH ---
router.get("/google", (req, res, next) => {
  const platform = req.query.platform as string;
  const isMobile = platform === "mobile";

  console.log(
    isMobile
      ? "Iniciando Google login desde móvil"
      : "Iniciando Google login desde web"
  );

  const state = JSON.stringify({
    platform: isMobile ? "mobile" : "web",
  });

  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
    state: state,
  })(req, res, next);
});

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
  }),
  async (req, res) => {
    const user = req.user as any;
    const stateParam = req.query.state as string;
    const state = stateParam ? JSON.parse(stateParam) : { platform: "web" };
    const isMobile = state.platform === "mobile";

    // Usuario nuevo -> onboarding
    if (user && !user.isExisting) {
      const tempTokenPayload: TempTokenPayload = {
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        isMobile,
        provider: user.provider,
        step: "incomplete_oauth_registration",
      };
      const tempToken = createTempToken(tempTokenPayload);

      if (isMobile) {
        return res.redirect(`dualeat://callback?tempToken=${tempToken}`);
      } else {
        return res.redirect(
          `${process.env.FRONTEND_URL}/onboarding?tempToken=${tempToken}`
        );
      }
    }

    // Usuario existente -> login
    if (user && user.isExisting) {
      const userData: UserSessionData = {
        id: user.id,
        name: user.name,
        email: user.email,
        slug: user.slug,
        role: user.role,
        provider: user.provider,
        isBusiness: user.isBusiness,
        active: user.active,
        subscription_status: user.subscription_status,
        trial_ends_at: user.trial_ends_at,
        avatar_url: user.avatar_url,
        loginAt: new Date(),
        lastActivity: new Date(),
      };

      const { accessToken, refreshToken } = await createTokenPair(
        userData,
        true,
        isMobile
      );

      if (isMobile) {
        // Mobile: redirigir con tokens en URL
        return res.redirect(
          `dualeat://callback?accessToken=${accessToken}&refreshToken=${refreshToken}`
        );
      } else {
        // Web: establecer cookies
        res.cookie("accessToken", accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
          maxAge: 15 * 60 * 1000, // 15 minutos
        });

        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/api/auth/refresh",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
        });

        if (user.isBusiness) {
          return res.redirect(`${process.env.FRONTEND_URL}/business/dashboard`);
        } else {
          return res.redirect(`${process.env.FRONTEND_URL}/feed`);
        }
      }
    }

    // Fallback
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }
);

// --- PASSWORD RESET ---
router.post(
  "/password_reset",
  generalLimiter,
  pcontroller.requestReset.bind(pcontroller)
);

router.post(
  "/password_reset/validate-code",
  generalLimiter,
  pcontroller.validateCode.bind(pcontroller)
);

router.post(
  "/password_reset/reset",
  generalLimiter,
  pcontroller.reset.bind(pcontroller)
);

export default router;
