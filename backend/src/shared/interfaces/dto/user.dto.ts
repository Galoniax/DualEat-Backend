import { LocalUserRole, Role } from "@prisma/client";

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
  verified: boolean;
  
  workplaces?: Workplace[]; 

  loginAt: Date;
  lastActivity: Date;
  deviceId?: string;
}

export interface Workplace {
  id: string;
  name: string;
  slug: string;
  role: LocalUserRole;
}


// Payload del Access Token (JWT)
export interface SecureTokenPayload {
  sub: string; // user ID hasheado
  rol: string; // role codificado
  prv: string; // provider codificado
  rem: boolean; // remember me
  dev: string // device ID
  ses: string; // session ID
  typ: "access"; // tipo de token
  iat?: number; // issued at
  exp?: number; // expiration
  jti?: string; // JWT ID
}

// Token temporal para onboarding
export interface TempTokenPayload {
  email: string;
  password_hash?: string;
  avatar_url?: string;
  provider: string;
  dev: string;
  step: "incomplete_registration" | "incomplete_oauth_registration";
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
