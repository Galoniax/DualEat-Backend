import jwt from "jsonwebtoken";
import { SECRET_KEY } from "../../core/config/config";
import {
  SecureTokenPayload,
  UserSessionData,
  TempTokenPayload,
} from "../interfaces/dto/user.dto";

import { Role } from "@prisma/client";
import crypto from "crypto";

import AuthSessionService from "../../modules/auth/services/auth-session.service";

const authSessionService = AuthSessionService.getInstance();

// ==================================
// Funciones auxiliares para el JWT
// ==================================
function hashUserId(userId: string): string {
  return crypto
    .createHash("sha256")
    .update(`${userId}:${SECRET_KEY}`)
    .digest("hex")
    .substring(0, 12);
}

function encodeRole(role: Role): string {
  const roleMap: Record<Role, string> = {
    ADMIN: "a",
    USER: "u",
  };
  return roleMap[role] || "u";
}

function encodeProvider(provider: string): string {
  const providerMap: Record<string, string> = {
    google: "g",
    local: "l",
  };
  return providerMap[provider] || "l";
}

// ==================================
// Creación de tokens seguros y temporales (JWT)
// ==================================
export async function createSecureToken(
  u: UserSessionData, // Datos del usuario
  r: boolean, // Remember me
  d: string, // Device ID
): Promise<string> {
  let ttlSeconds = 24 * 60 * 60;

  if (r) {
    ttlSeconds = 14 * 24 * 60 * 60;
  } else {
    ttlSeconds = 24 * 60 * 60;
  }

  // Crear sesión en Redis (Con el nuevo TTL)
  const sessionId = await authSessionService.createSession(u, d, ttlSeconds);

  const payload: SecureTokenPayload = {
    sub: hashUserId(u.id),
    rol: encodeRole(u.role),
    prv: encodeProvider(u.provider),
    rem: r,
    dev: d,
    ses: sessionId,
    typ: "access",
  };

  return jwt.sign(payload, SECRET_KEY, {
    algorithm: "HS256",
    expiresIn: r ? "14d" : "1d",
    jwtid: crypto.randomUUID(),
  });
}

export function createTempToken(payload: TempTokenPayload): string {
  return jwt.sign(payload, SECRET_KEY, {
    algorithm: "HS256",
    expiresIn: "30m",
    jwtid: crypto.randomUUID(),
  });
}

// ==================================
// Verificación de tokens
// ==================================
export function verifyAccessToken(
  t: string, // Token JWT
) {
  return jwt.verify(t, SECRET_KEY) as any;
}

export function verifyTempToken(
  t: string, // Token JWT
): TempTokenPayload {
  const payload = jwt.verify(t, SECRET_KEY) as TempTokenPayload;

  if (
    payload.step !== "incomplete_registration" &&
    payload.step !== "incomplete_oauth_registration"
  ) {
    throw new Error("Token temporal no válido");
  }
  return payload;
}
