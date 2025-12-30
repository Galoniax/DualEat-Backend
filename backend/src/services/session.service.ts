// Asegúrate de que tu SessionService tenga estos métodos
// Si ya los tienes, ignora este archivo

import Redis from "ioredis";
import crypto from "crypto";

class SessionService {
  private static instance: SessionService;
  private redis: Redis;

  private constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      // Añade más configuración según tu setup
    });
  }

  static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  // Generar ID único para sesiones
  generateUniqueId(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  // Guardar datos con TTL
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.setex(key, ttlSeconds, value);
  }

  // Obtener datos
  async get(key: string): Promise<string | null> {
    return await this.redis.get(key);
  }

  // Eliminar datos
  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  // Obtener TTL restante
  async getTtl(key: string): Promise<number> {
    return await this.redis.ttl(key);
  }

  // Actualizar TTL de una key existente
  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.redis.expire(key, ttlSeconds);
  }

  // Buscar keys por patrón
  async keys(pattern: string): Promise<string[]> {
    return await this.redis.keys(pattern);
  }

  // Cerrar conexión (útil para testing o shutdown)
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

export default SessionService;