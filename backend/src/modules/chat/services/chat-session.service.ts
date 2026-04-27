import { ChatSession } from "src/shared/interfaces/types/chat.types";
import SessionService from "../../../core/services/session.service";

export class ChatSessionService {
  private readonly SESSION_PREFIX = "chat:";
  private static instance: ChatSessionService;

  private sessionService = SessionService.getInstance();

  private constructor() {}

  static getInstance(): ChatSessionService {
    if (!ChatSessionService.instance) {
      ChatSessionService.instance = new ChatSessionService();
    }
    return ChatSessionService.instance;
  }

  // =========================================================
  // OBTENER CHAT POR ID
  // =========================================================
  async getById(u_id: string, c_id: string): Promise<ChatSession | null> {
    try {
      const sessionKey = `${this.SESSION_PREFIX}${u_id}/${c_id}`;
      const data = await this.sessionService.get(sessionKey);

      if (!data) {
        return null;
      }

      const chatData: ChatSession = JSON.parse(data);
      return chatData;
    } catch (e) {
      return null;
    }
  }

  // =========================================================
  // OBTENER TODOS LOS CHATS DE UN USUARIO
  // =========================================================
  async getUserChats(
    u_id: string,
    search?: string,
  ): Promise<ChatSession[] | null> {
    try {
      const pattern = `${this.SESSION_PREFIX}${u_id}/*`;
      const keys = await this.sessionService.keys(pattern);

      const chats: ChatSession[] = [];

      const normalizedSearch = search?.toLowerCase().trim();

      for (const key of keys) {
        const data = await this.sessionService.get(key);

        if (data) {
          const chatData = JSON.parse(data);

          if (chatData) {
            if (
              normalizedSearch &&
              !chatData.title.toLowerCase().includes(normalizedSearch)
            ) {
              continue;
            }
            chats.push({
              chat_id: chatData.chat_id,
              title: chatData.title,
              createdAt: chatData.createdAt,
              lastActivity: chatData.lastActivity,
              messages: [],
              recipe_id: chatData.recipe_id,
            });
          }
        }
      }

      return chats.sort(
        (a, b) =>
          new Date(b.lastActivity).getTime() -
          new Date(a.lastActivity).getTime(),
      );
    } catch (e) {
      return null;
    }
  }

  // =========================================================
  // AGREGAR MENSAJES AL CHAT
  // =========================================================
  async addMessage(
    u_id: string, // user_id
    chat: ChatSession,
  ) {
    if (!u_id || !chat.chat_id)
      throw new Error("ID de usuario y chat requeridos.");

    if (!chat.messages || chat.messages.length === 0) {
      throw new Error("Debe proporcionar al menos un mensaje.");
    }

    try {
      const redisKey = `${this.SESSION_PREFIX}${u_id}/${chat.chat_id}`;
      let ttl = 3 * 24 * 60 * 60;

      const data = await this.sessionService.get(redisKey);

      if (data) {
        // ==========================================
        // CASO A: EL CHAT YA EXISTE (Actualizamos)
        // ==========================================
        const chatData: ChatSession = JSON.parse(data);

        chatData.messages.push(...chat.messages);
        chatData.lastActivity = new Date().toISOString();

        chatData.title = chat.title;
        
        if (chat.recipe_id) {
          chatData.recipe_id = chat.recipe_id;
        }

        // 1. Guardar en Redis (Guardamos la sesión con un TTL (en segundos))
        await this.sessionService.set(redisKey, JSON.stringify(chatData), ttl);

        return chatData;
      } else {
        // ==========================================
        // CASO B: EL CHAT ES NUEVO (Creamos)
        // ==========================================
        const chatData: ChatSession = {
          chat_id: chat.chat_id,
          title: chat.title,
          createdAt: chat.createdAt,
          lastActivity: chat.lastActivity,
          messages: chat.messages,
          recipe_id: chat.recipe_id || undefined,
        };

        await this.sessionService.set(redisKey, JSON.stringify(chatData), ttl);

        return chatData;
      }
    } catch (e) {
      return null;
    }
  }

  // =========================================================
  // EDITAR TITULO DEL CHAT
  // =========================================================
  async editTitle(c_id: string, u_id: string, t: string) {
    try {
      const redisKey = `${this.SESSION_PREFIX}${u_id}/${c_id}`;

      const data = await this.sessionService.get(redisKey);

      if (!data) return null;

      const chatData: ChatSession = JSON.parse(data);
      chatData.title = t;
      chatData.lastActivity = new Date().toISOString();

      const ttl = await this.sessionService.getTtl(redisKey);

      await this.sessionService.set(redisKey, JSON.stringify(chatData), ttl);

      return chatData;
    } catch (e) {
      return null;
    }
  }

  // =========================================================
  // ELIMINAR CHAT
  // =========================================================
  async deleteChat(c_id: string, u_id: string): Promise<boolean> {
    try {
      const key = `${this.SESSION_PREFIX}${u_id}/${c_id}`;
      const data = await this.sessionService.get(key);

      if (!data) return false;

      await this.sessionService.delete(key);

      return true;
    } catch (e) {
      return false;
    }
  }

  // =========================================================
  // ELIMINAR TODOS LOS CHATS DE UN USUARIO
  // =========================================================
  async deleteAllChats(u_id: string): Promise<boolean> {
    try {
      const pattern = `${this.SESSION_PREFIX}${u_id}/*`;
      const keys = await this.sessionService.keys(pattern);

      for (const key of keys) {
        await this.sessionService.delete(key);
      }

      return true;
    } catch (e) {
      return false;
    }
  }
}

export default ChatSessionService;
