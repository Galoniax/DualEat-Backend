import { verifyAccessToken, signAccessToken } from "@/shared/utils/jwt";
import AuthSessionService from "@/modules/auth/services/auth-session.service";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const authSessionService = AuthSessionService.getInstance();

export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let token = req.cookies.accessToken;

    if (!token && req.headers.authorization) {
      const header = req.headers.authorization;

      if (header.startsWith("Bearer ")) {
        token = header.substring(7);
      }
    }

    if (!token) {
      throw new Error("Token no encontrado");
    }

    let payload: any;
    let isExpired = false;

    try {
      payload = verifyAccessToken(token);
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        payload = jwt.decode(token);
        isExpired = true;
      } else {
        throw err;
      }
    }

    if (!payload || payload.typ !== "access") {
      throw new Error("Tipo de token inválido");
    }

    const sessionMetadata = await authSessionService.getSession(
      payload.ses,
      payload.dev,
      payload.rem,
    );

    if (!sessionMetadata) {
      throw new Error("Sesión expirada");
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    const halfLife = payload.iat + (payload.exp - payload.iat) / 2;

    if (isExpired || nowInSeconds >= halfLife) {
      const newToken = signAccessToken({
        sub: payload.sub,
        rol: payload.rol,
        prv: payload.prv,
        rem: payload.rem,
        dev: payload.dev,
        ses: payload.ses,
        typ: "access",
      });

      res.cookie("accessToken", newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
        maxAge: payload.rem ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
      });

      res.setHeader("X-New-Access-Token", newToken);
      res.setHeader("Access-Control-Expose-Headers", "X-New-Access-Token");
    }

    req.user = {
      id: sessionMetadata.id,
      role: sessionMetadata.role,
      deviceId: sessionMetadata.deviceId,
    };
    req.sessionId = payload.ses;

    next();
  } catch (e: any) {
    return res
      .status(401)
      .clearCookie("accessToken")
      .json({
        success: false,
        message: e.message || "Token inválido o expirado",
      });
  }
};
