import { Request, Response, NextFunction } from "express";
import { UserSessionData } from "@/shared/interfaces/dto/user.dto";

export const requireSubscription = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = req.user as UserSessionData;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "No autenticado. Por favor inicie sesión.",
    });
  }

  if (user.role === "ADMIN") {
    return next();
  }

  const status = user.subscription_status?.toUpperCase();
  if (status !== "ACTIVE" && status !== "TRIAL") {
    return res.status(403).json({
      success: false,
      message:
        "Acceso denegado: Se requiere una suscripción activa para usar esta función.",
    });
  }

  if (
    status === "TRIAL" &&
    user.trial_ends_at &&
    new Date(user.trial_ends_at) < new Date()
  ) {
    return res.status(403).json({
      success: false,
      message: "Acceso denegado: Su período de prueba ha expirado.",
    });
  }

  next();
};
