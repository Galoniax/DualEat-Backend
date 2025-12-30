import { UserSessionData } from "../../../shared/interfaces/user.dto";
import SessionService from "../../../services/session.service";

export class AuthSessionService {
  private readonly SESSION_PREFIX = "session:";
  private readonly REFRESH_TOKEN_PREFIX = "refresh:";
  private readonly USER_SESSION_PREFIX = "user-session:";

  private static instance: AuthSessionService;
  private sessionService: SessionService;

  private constructor() {
    this.sessionService = SessionService.getInstance();
  }

  static getInstance(): AuthSessionService {
    if (!AuthSessionService.instance) {
      AuthSessionService.instance = new AuthSessionService();
    }
    return AuthSessionService.instance;
  }

  // ==================================
  // GESTIÓN DE SESIONES
  // ==================================
  async createSession(
    userData: Omit<UserSessionData, "loginAt" | "lastActivity">,
    ttlSeconds: number,
    device: "web" | "mobile"
  ): Promise<string> {
    const userKey = `${this.USER_SESSION_PREFIX}${userData.id}:${device}`;

    // 1️⃣ ¿Ya hay sesión activa?
    const existingSessionId = await this.sessionService.get(userKey);
    if (existingSessionId) {
      // Actualizar TTL de la sesión existente
      const sessionKey = `${this.SESSION_PREFIX}${existingSessionId}`;
      const existingTtl = await this.sessionService.getTtl(sessionKey);

      // Solo actualizar si aún existe
      if (existingTtl > 0) {
        await this.sessionService.expire(sessionKey, ttlSeconds);
        await this.sessionService.expire(userKey, ttlSeconds);
        console.log(`♻️ Sesión existente reutilizada: ${existingSessionId}`);
        return existingSessionId;
      }
    }

    // 2️⃣ Crear nueva sesión
    const sessionId = this.sessionService.generateUniqueId();

    const sessionData: UserSessionData = {
      ...userData,
      loginAt: new Date(),
      lastActivity: new Date(),
    };

    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;

    await this.sessionService.set(
      sessionKey,
      JSON.stringify(sessionData),
      ttlSeconds
    );

    // 3️⃣ Guardar índice usuario -> sesión
    await this.sessionService.set(userKey, sessionId, ttlSeconds);

    console.log(
      `✅ Sesión creada: ${sessionId} (TTL: ${ttlSeconds}s, device: ${device})`
    );
    return sessionId;
  }

  async getSession(
    sessionId: string,
    isMobile: boolean
  ): Promise<UserSessionData | null> {
    try {
      const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
      const data = await this.sessionService.get(sessionKey);

      if (!data) {
        console.warn(`⚠️ Sesión no encontrada: ${sessionId}`);
        return null;
      }

      const sessionData: UserSessionData = JSON.parse(data);

      // Actualizar última actividad
      sessionData.lastActivity = new Date();
      const ttl = await this.sessionService.getTtl(sessionKey);

      if (ttl > 0) {
        await this.sessionService.set(
          sessionKey,
          JSON.stringify(sessionData),
          ttl
        );
      }

      return sessionData;
    } catch (error) {
      console.error("❌ Error obteniendo sesión:", error);
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;

      // Primero obtener los datos de la sesión para limpiar el índice
      const data = await this.sessionService.get(sessionKey);

      if (data) {
        const sessionData: UserSessionData = JSON.parse(data);

        // Limpiar índices de usuario para ambos dispositivos
        const webUserKey = `${this.USER_SESSION_PREFIX}${sessionData.id}:web`;
        const mobileUserKey = `${this.USER_SESSION_PREFIX}${sessionData.id}:mobile`;

        await this.sessionService.delete(webUserKey);
        await this.sessionService.delete(mobileUserKey);
      }

      // Eliminar todos los refresh tokens asociados a esta sesión
      await this.revokeAllRefreshTokens(sessionId);

      // Eliminar la sesión
      await this.sessionService.delete(sessionKey);

      console.log(`🗑️ Sesión eliminada: ${sessionId}`);
    } catch (error) {
      console.error("❌ Error eliminando sesión:", error);
    }
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    try {
      const pattern = `${this.SESSION_PREFIX}*`;
      const keys = await this.sessionService.keys(pattern);

      for (const key of keys) {
        const data = await this.sessionService.get(key);
        if (data) {
          const sessionData: UserSessionData = JSON.parse(data);
          if (sessionData.id === userId) {
            const sessionId = key.replace(this.SESSION_PREFIX, "");
            await this.deleteSession(sessionId);
          }
        }
      }

      console.log(`🗑️ Todas las sesiones del usuario ${userId} eliminadas`);
    } catch (error) {
      console.error("❌ Error eliminando sesiones del usuario:", error);
    }
  }

  // ==================================
  // GESTIÓN DE REFRESH TOKENS
  // ==================================
  async storeRefreshToken(
    sessionId: string,
    hashedJti: string,
    ttlSeconds: number
  ): Promise<void> {
    try {
      const key = `${this.REFRESH_TOKEN_PREFIX}${sessionId}:${hashedJti}`;
      await this.sessionService.set(key, "valid", ttlSeconds);
      console.log(`🔄 Refresh token almacenado para sesión: ${sessionId}`);
    } catch (error) {
      console.error("❌ Error almacenando refresh token:", error);
      throw error;
    }
  }

  async isRefreshTokenValid(
    sessionId: string,
    hashedJti: string
  ): Promise<boolean> {
    try {
      const key = `${this.REFRESH_TOKEN_PREFIX}${sessionId}:${hashedJti}`;
      const value = await this.sessionService.get(key);
      return value === "valid";
    } catch (error) {
      console.error("❌ Error verificando refresh token:", error);
      return false;
    }
  }

  async revokeRefreshToken(
    sessionId: string,
    hashedJti: string
  ): Promise<void> {
    try {
      const key = `${this.REFRESH_TOKEN_PREFIX}${sessionId}:${hashedJti}`;
      await this.sessionService.delete(key);
      console.log(`🗑️ Refresh token revocado: ${hashedJti.substring(0, 8)}...`);
    } catch (error) {
      console.error("❌ Error revocando refresh token:", error);
    }
  }

  async revokeAllRefreshTokens(sessionId: string): Promise<void> {
    try {
      const pattern = `${this.REFRESH_TOKEN_PREFIX}${sessionId}:*`;
      const keys = await this.sessionService.keys(pattern);

      for (const key of keys) {
        await this.sessionService.delete(key);
      }

      if (keys.length > 0) {
        console.log(
          `🗑️ ${keys.length} refresh tokens revocados para sesión ${sessionId}`
        );
      }
    } catch (error) {
      console.error("❌ Error revocando refresh tokens:", error);
    }
  }
}

export default AuthSessionService;
