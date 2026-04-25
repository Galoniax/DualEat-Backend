import { Request, Response, NextFunction } from "express";
import { UserSessionData } from "../../shared/interfaces/user.dto";

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as UserSessionData;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "No autenticado. Por favor inicie sesión como administrador.",
    });
  }

  if (user.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Acceso denegado: Se requieren permisos de administrador",
    });
  }

  next();
};
