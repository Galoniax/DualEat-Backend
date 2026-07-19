import { ChatSessionData } from "@/shared/interfaces/types/chat.types";
import Groq from "groq-sdk";

export class AIService {
  private static instance: AIService;
  private groq: Groq;

  private readonly INTENT_MODEL =
    process.env.INTENT_MODEL || "openai/gpt-oss-20b";

  private readonly CHAT_MODEL = process.env.CHAT_MODEL || "openai/gpt-oss-120b";

  private constructor() {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  public async detectIntent(question: string): Promise<{
    type: "SEARCH" | "CHAT";
    query: string | null;
  }> {
    const systemPrompt = `Analiza la intención del usuario. Clasifica en uno de estos 2 tipos:

    1. type="SEARCH" → El usuario menciona CUALQUIER tema relacionado con comida, cocina, ingredientes, recetas, técnicas culinarias, recomendaciones de comida, nutrición, o gastronomía en general.
       - Ejemplo: "Dame recetas con papas" → SEARCH, query="papas"
       - Ejemplo: "Quiero cocinar pollo al horno" → SEARCH, query="pollo horno"
       - Ejemplo: "¿Qué me recomiendas hacer con papas?" → SEARCH, query="papas"
       - Ejemplo: "¿Qué puedo cocinar con este clima?" → SEARCH, query=null
       - Ejemplo: "¿Qué queso queda bien con papas?" → SEARCH, query="papas"
       - Ejemplo: "¿Qué diferencia hay entre hornear y asar?" → SEARCH, query=null
       - IMPORTANTE: En "query", extrae solo las palabras clave de ingredientes o platos (sustantivos). Si no hay ingredientes/platos específicos, query=null.
       - Elimina palabras como "receta", "dame", "con", "de", "quiero", "recomiendas".

    2. type="CHAT" → El usuario conversa de temas NO relacionados con comida/cocina.
       - Ejemplo: "Hola, ¿cómo estás?" → CHAT
       - Ejemplo: "Hablemos de fútbol" → CHAT

    Responde ÚNICAMENTE con un JSON válido:
    {
      "type": "SEARCH" | "CHAT",
      "query": "string o null"
    }`;

    try {
      const response = await this.groq.chat.completions.create({
        model: this.INTENT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Mensaje: "${question}"` },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const responseText =
        response.choices[0]?.message?.content ||
        '{"type": "CHAT", "query": null}';
      return JSON.parse(responseText);
    } catch (error) {
      console.error("Error en Groq detectIntent:", error);

      return { type: "CHAT", query: null };
    }
  }

  // FORMATEAR HISTORIAL (Estilo OpenAI)
  // =========================================================
  private formatMessages(
    systemInstruction: string,
    conversation: any[] = [],
    currentQuestion: string,
  ) {
    const messages = [];

    // 1. Agregar instrucción de sistema primero
    messages.push({
      role: "system",
      content: systemInstruction,
    });

    const safe = Array.isArray(conversation) ? conversation : [];

    // 2. Mapear el historial previo
    const history = (Array.isArray(safe) ? safe : []).map((msg) => ({
      role:
        msg.role.toLowerCase() === "ia" ||
        msg.role.toLowerCase() === "assistant"
          ? "assistant"
          : "user",
      content: msg.text || msg.content,
    }));

    messages.push(...history);

    // 3. Agregar la pregunta actual
    messages.push({ role: "user", content: currentQuestion });

    return messages;
  }

  // GENERAR RESPUESTA DE CHAT
  // =========================================================
  async generateChatResponse(
    systemInstruction: string,
    conversation: ChatSessionData[] = [],
    question: string,
  ): Promise<string> {
    try {
      const messages = this.formatMessages(
        systemInstruction,
        conversation,
        question,
      );

      const response = await this.groq.chat.completions.create({
        model: this.CHAT_MODEL,
        messages: messages as any,
        temperature: 0.5,
        max_tokens: 512,
      });
      console.log("RESPONSECHAT", response);

      const rawContent =
        response.choices[0]?.message?.content ||
        "Lo siento, no pude procesar tu solicitud.";

      const cleanContent = rawContent
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .trim();

      return cleanContent || "Lo siento, no pude procesar tu solicitud.";
    } catch (e: any) {
      console.log("Error en Groq generateChatResponse:", e);
      if (e.status === 413)
        throw new Error("Error: El historial es demasiado largo.");
      if (e.status === 429)
        throw new Error(
          "Error: Demasiadas peticiones (Límite de Groq alcanzado).",
        );

      throw new Error("Hubo un problema técnico con el motor de IA.");
    }
  }
}
