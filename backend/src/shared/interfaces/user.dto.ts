import { Role, SubscriptionStatus } from "@prisma/client";

/*
export interface BasicCreateDTO {
  email: string;
  name: string;
  slug: string;
  password_hash?: string;
  avatar_url?: string | null;
  provider?: string;
  foodPreferences?: number[];
  communityPreferences?: number[];
}

export interface RegisterStepTwoDto {
  name: string;
  foodPreferences?: number[];
  communityPreferences?: number[];
}

// Tipos de payload
export interface SecureTokenPayload {
  sub: string;           // Hash del user ID
  rol: string;          // Role codificado
  ses: string;          // Session ID único
  prv: string;          // Provider codificado
  rem?: boolean;         // Valor de "remember me"
  mob: boolean;         // Indica si es móvil
  typ: "access";
  iat?: number;
  exp?: number;
}

export type Device = "web" | "mobile";

export interface TempTokenPayload {
  email: string;
  password_hash?: string;   
  provider?: string;
  isMobile?: boolean;
  avatar_url?: string;
  name?: string;
  step: 'incomplete_registration' | 'incomplete_oauth_registration';
}

// Datos completos del usuario (guardados en Redis)
export interface UserSessionData {
  id: string;
  name: string;
  email: string;
  slug: string;
  role: Role;
  provider: string;
  isBusiness: boolean;
  active: boolean;
  subscription_status: SubscriptionStatus;
  trial_ends_at: Date | null;
  avatar_url: string | null;
  loginAt: Date;
  lastActivity: Date;
}

*/

// Datos de sesión del usuario almacenados en Redis
export interface UserSessionData {
  id: string;
  name: string;
  email: string;
  slug: string;
  role: Role;
  provider: string;
  isBusiness: boolean;
  active: boolean;
  subscription_status: string;
  trial_ends_at: Date | null;
  avatar_url: string | null;
  loginAt: Date;
  lastActivity: Date;
}

// Payload del Access Token (JWT)
export interface SecureTokenPayload {
  sub: string;           // user ID hasheado
  rol: string;           // role codificado
  prv: string;           // provider codificado
  mob: boolean;          // es mobile?
  ses: string;           // session ID
  typ: "access";         // tipo de token
  iat?: number;          // issued at
  exp?: number;          // expiration
  jti?: string;          // JWT ID
}

// Payload del Refresh Token (JWT)
export interface RefreshTokenPayload {
  ses: string;           // session ID
  mob: boolean;          // es mobile?
  typ: "refresh";        // tipo de token
  jti: string;           // JWT ID (para rotación)
  iat?: number;          // issued at
  exp?: number;          // expiration
}

// Token temporal para onboarding
export interface TempTokenPayload {
  email: string;
  name?: string;
  password_hash?: string;
  avatar_url?: string;
  provider: string;
  step: "incomplete_registration" | "incomplete_oauth_registration";
  isMobile?: boolean;
  iat?: number;
  exp?: number;
  jti?: string;
}

// DTO para registro (paso 1)
export interface RegisterStepOneDto {
  email: string;
  password: string;
  isMobile?: boolean;
}

// DTO para completar perfil (paso 2)
export interface RegisterStepTwoDto {
  name: string;
  foodPreferences?: string[];
  communityPreferences?: string[];
}

// DTO para crear usuario en DB
export interface BasicCreateDTO {
  email: string;
  name: string;
  slug: string;
  password_hash?: string;
  avatar_url?: string;
  provider: string;
  foodPreferences?: string[];
  communityPreferences?: string[];
}

// Tipo para dispositivo
export type Device = "web" | "mobile";


