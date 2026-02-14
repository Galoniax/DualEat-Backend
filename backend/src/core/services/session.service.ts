import Redis from "ioredis";
import crypto from "crypto";

class SessionService {
  private static instance: SessionService;
  private redis: Redis;

  // ==========================================
  // 1. CONFIGURACIÓN
  // ==========================================
  private constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD || undefined, 
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.redis.on("error", (err) => {
      console.error("Error en conexión Redis:", err);
    });
  }

  public static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  // ==========================================
  // 2. MÉTODOS KEY-VALUE
  // ==========================================
  async set(key: string, value: string, ttl: number): Promise<void> {
    await this.redis.setex(key, ttl, value);
  }

  // Obtiene un valor por su clave
  async get(key: string): Promise<string | null> {
    return await this.redis.get(key);
  }

  // Elimina una clave
  async delete(key: string): Promise<number> {
    return await this.redis.del(key);
  }

  // Obtiene el tiempo de vida restante en segundos
  async getTtl(key: string): Promise<number> {
    return await this.redis.ttl(key);
  }

  // Renueva o actualiza el TTL de una clave existente
  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.redis.expire(key, seconds);
    return result === 1;
  }

  // ==========================================
  // 3. MÉTODOS HASH (Para User Index / Multidevice)
  // ==========================================

  // Guarda un campo dentro de un Hash
  async hSet(key: string, field: string, value: string): Promise<number> {
    return await this.redis.hset(key, field, value);
  }

  // Obtiene un campo específico de un Hash
  async hGet(key: string, field: string): Promise<string | null> {
    return await this.redis.hget(key, field);
  }

  // Obtiene TODOS los campos de un Hash
  async hGetAll(key: string): Promise<Record<string, string>> {
    return await this.redis.hgetall(key);
  }

  // Elimina un campo específico de un Hash
  async hDel(key: string, field: string): Promise<number> {
    return await this.redis.hdel(key, field);
  }

  // ==========================================
  // 4. UTILIDADES
  // ==========================================

  // Genera un ID seguro para las sesiones
  generateUniqueId(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  // Busca keys por patrón
  async keys(pattern: string): Promise<string[]> {
    return await this.redis.keys(pattern);
  }

  // Cierra la conexión con Redis
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

export default SessionService;