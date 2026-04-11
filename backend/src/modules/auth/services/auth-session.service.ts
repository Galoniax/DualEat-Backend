import { UserSessionData } from "../../../shared/interfaces/dto/user.dto";
import SessionService from "../../../core/services/session.service";

export class AuthSessionService {
  private readonly SESSION_PREFIX = "session:";

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

  // 1. CREAR SESIÓN
  async createSession(
    u: Omit<UserSessionData, "loginAt" | "lastActivity">,
    d: string, // Device ID
    ttl: number,
  ): Promise<string> {
    const userKey = `user-sessions:${u.id}`;

    // 1. Verificar si ya existe
    const existing = await this.sessionService.hGet(userKey, d);

    if (existing) {
      const sessionKey = `${this.SESSION_PREFIX}${existing}`;

      const isValid = await this.sessionService.get(sessionKey);

      if (isValid) {
        console.log("Sesión existente válida encontrada:", existing);

        await this.sessionService.expire(sessionKey, ttl);

        await this.sessionService.expire(userKey, ttl);
        return existing;
      } else {
        console.log(
          "Sesión existente pero inválida encontrada, eliminando índice:",
          existing,
        );
        await this.sessionService.hDel(userKey, d);
      }
    }

    const sessionId = this.sessionService.generateUniqueId();

    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;

    const sessionData: UserSessionData = {
      ...u,
      loginAt: new Date(),
      lastActivity: new Date(),
      deviceId: d,
    };

    // 2. Guardar en Redis (Guardamos la sesión con un TTL (en segundos))
    await this.sessionService.set(sessionKey, JSON.stringify(sessionData), ttl);

    // 3. Guardar índice para el usuario junto con el hash
    await this.sessionService.hSet(userKey, d, sessionId);

    // Opcional: Actualizar expiración al mapa del usuario también para que no sea eterno
    await this.sessionService.expire(userKey, ttl);

    return sessionId;
  }

  // 2. OBTENER SESIÓN
  async getSession(
    s: string, // Session ID
    d: string, // Device ID
    r: boolean,
  ): Promise<UserSessionData | null> {
    try {
      const sessionKey = `${this.SESSION_PREFIX}${s}`;

      let ttl = 24 * 60 * 60;

      if (r) ttl = 14 * 24 * 60 * 60;
      else ttl = 24 * 60 * 60;

      // Obtener datos crudos
      const data = await this.sessionService.get(sessionKey);
      if (!data) return null;

      const sessionData: UserSessionData = JSON.parse(data);

      if (sessionData.deviceId !== d) {
        // Eliminar sesión comprometida
        await this.sessionService.delete(sessionKey);
        return null;
      }

      // Actualizar actividad
      sessionData.lastActivity = new Date();

      // Actualizar datos
      await this.sessionService.set(
        sessionKey,
        JSON.stringify(sessionData),
        ttl,
      );

      // Renovar el TTL del índice y session
      await this.sessionService.expire(`user-sessions:${sessionData.id}`, ttl);

      await this.sessionService.expire(sessionKey, ttl);

      return sessionData;
    } catch (error) {
      console.error("Error obteniendo sesión:", error);
      return null;
    }
  }

  // 3. ELIMINAR SESIÓN
  async deleteSession(
    s: string, // Session ID
  ): Promise<void> {
    try {
      const sessionKey = `${this.SESSION_PREFIX}${s}`;

      // 1. Obtener datos de sesión para eliminar índice
      const data = await this.sessionService.get(sessionKey);

      if (data) {
        const sessionData: UserSessionData = JSON.parse(data);
        const { id, deviceId } = sessionData;

        if (id && deviceId) {
          const userKey = `user-sessions:${id}`;
          await this.sessionService.hDel(userKey, deviceId);
          console.log(`Índice eliminado para User ${id}, Device ${deviceId}`);
        }
      }

      // 2. Borrar la data de la sesión
      await this.sessionService.delete(sessionKey);

      console.log(`Sesión eliminada: ${sessionKey}`);
    } catch (e) {
      console.error("Error eliminando sesión:", e);
    }
  }

  // 4. REVOCA TODAS LAS SESIONES DE UN USUARIO
  async revokeAllUserSessions(userId: string): Promise<void> {
    try {
      const userIndexKey = `user-sessions:${userId}`;

      // 1. Obtener todos los sessionIds activos de este usuario
      const allSes = await this.sessionService.hGetAll(userIndexKey);

      if (allSes) {
        const sessionIds = Object.values(allSes);

        // 2. Borrar cada sesión individualmente
        await Promise.all(
          sessionIds.map((sid) =>
            this.sessionService.delete(`${this.SESSION_PREFIX}${sid}`),
          ),
        );
        console.log(`Eliminadas ${sessionIds.length} sesiones activas.`);
      }

      // 3. Borrar el índice completo del usuario
      await this.sessionService.delete(userIndexKey);

      console.log(`Revocación total completada para usuario ${userId}`);
    } catch (e) {
      console.error("Error en revocación masiva:", e);
    }
  }
}

export default AuthSessionService;
