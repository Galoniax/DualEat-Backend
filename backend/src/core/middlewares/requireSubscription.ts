import { Request, Response, NextFunction } from "express";
import { prisma } from "@/core/database/prisma/prisma";

export const requireSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "No autenticado. Por favor inicie sesión.",
    });
  }

  if (user.role === "ADMIN") {
    return next();
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { subscription_status: true, trial_ends_at: true },
  });

  if (!dbUser) {
    return res.status(401).json({
      success: false,
      message: "Usuario no encontrado.",
    });
  }

  const status = dbUser.subscription_status?.toUpperCase();
  if (status !== "ACTIVE" && status !== "TRIAL") {
    return res.status(403).json({
      success: false,
      message:
        "Acceso denegado: Se requiere una suscripción activa para usar esta función.",
    });
  }

  if (
    status === "TRIAL" &&
    dbUser.trial_ends_at &&
    new Date(dbUser.trial_ends_at) < new Date()
  ) {
    return res.status(403).json({
      success: false,
      message: "Acceso denegado: Su período de prueba ha expirado.",
    });
  }

  next();
};
