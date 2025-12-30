import jwt from "jsonwebtoken";
import { SECRET_KEY } from "../../core/config/config";
import {
  SecureTokenPayload,
  UserSessionData,
  TempTokenPayload,
} from "../interfaces/user.dto";

import { Role } from "@prisma/client";
import crypto from "crypto";

import AuthSessionService from "../../modules/auth/services/auth-session.service";

const authSessionService = AuthSessionService.getInstance();

// ==================================
// Funciones auxiliares
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
    admin: "a",
    user: "u",
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

export function hashTokenId(jti: string): string {
  return crypto
    .createHash("sha256")
    .update(jti + ":" + SECRET_KEY)
    .digest("hex");
}

// ==================================
// ACCESS TOKEN (corta duración)
// ==================================
export async function createAccessToken(
  userData: UserSessionData,
  sessionId: string,
  isMobile: boolean
): Promise<string> {
  const payload: SecureTokenPayload = {
    sub: hashUserId(userData.id),
    rol: encodeRole(userData.role),
    prv: encodeProvider(userData.provider),
    mob: isMobile,
    ses: sessionId,
    typ: "access",
  };

  // Access token de CORTA duración (15 minutos)
  return jwt.sign(payload, SECRET_KEY, {
    algorithm: "HS256",
    expiresIn: "15m",
    jwtid: crypto.randomUUID(),
  });
}

// ==================================
// REFRESH TOKEN (larga duración)
// ==================================
export async function createRefreshToken(
  sessionId: string,
  isMobile: boolean
): Promise<string> {
  const jti = crypto.randomUUID();

  const payload = {
    ses: sessionId,
    mob: isMobile,
    typ: "refresh",
    jti,
  };

  const expiresIn = isMobile ? "30d" : "7d";

  // Guardar el jti hasheado en Redis para poder revocarlo
  const hashedJti = hashTokenId(jti);
  const ttlSeconds = isMobile ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;

  await authSessionService.storeRefreshToken(sessionId, hashedJti, ttlSeconds);

  return jwt.sign(payload, SECRET_KEY, {
    algorithm: "HS256",
    expiresIn,
    jwtid: jti,
  });
}

// ==================================
// CREAR PAR DE TOKENS (Access + Refresh)
// ==================================
export async function createTokenPair(
  userData: UserSessionData,
  rememberMe: boolean,
  isMobile: boolean
): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
  // Determinar TTL de la sesión basado en el dispositivo
  const ttlSeconds = isMobile
    ? 30 * 24 * 60 * 60 // 30 días para mobile
    : rememberMe
      ? 7 * 24 * 60 * 60 // 7 días si recordar
      : 24 * 60 * 60; // 1 día por defecto

  const device = isMobile ? "mobile" : "web";

  // Crear sesión en Redis
  const sessionId = await authSessionService.createSession(
    userData,
    ttlSeconds,
    device
  );

  // Crear ambos tokens
  const accessToken = await createAccessToken(userData, sessionId, isMobile);
  const refreshToken = await createRefreshToken(sessionId, isMobile);

  return { accessToken, refreshToken, sessionId };
}

// ==================================
// TOKENS TEMPORALES (onboarding)
// ==================================
export function createTempToken(payload: TempTokenPayload): string {
  return jwt.sign(payload, SECRET_KEY, {
    algorithm: "HS256",
    expiresIn: "30m",
    jwtid: crypto.randomUUID(),
  });
}

// ==================================
// VERIFICACIÓN DE TOKENS
// ==================================
export function verifyAccessToken(token: string): SecureTokenPayload {
  return jwt.verify(token, SECRET_KEY) as SecureTokenPayload;
}

export function verifyRefreshToken(token: string): any {
  const payload = jwt.verify(token, SECRET_KEY) as any;

  // Verificar que es un refresh token
  if (payload.typ !== "refresh") {
    throw new Error("Token inválido: no es un refresh token");
  }

  return payload;
}

export function verifyTempToken(token: string): TempTokenPayload {
  return jwt.verify(token, SECRET_KEY) as TempTokenPayload;
}
