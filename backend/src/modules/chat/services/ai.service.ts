import Groq from "groq-sdk";

export class AIService {
  private static instance: AIService;
  private groq: Groq;

  private readonly INTENT_MODEL = "llama-3.1-8b-instant";
  private readonly CHAT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

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

  public async detectIntent(
    question: string,
  ): Promise<{ type: "SEARCH" | "CHAT"; query: string | null }> {
    const systemPrompt = `Analiza la intención del usuario en la app DualEat.
    - Si busca recetas o ingredientes, type="SEARCH". 
    - IMPORTANTE: En "query", extrae solo las palabras clave esenciales (sustantivos). Elimina palabras como "receta", "dame", "con", "de", "quiero".
    - Ejemplo: "Dame una receta con papas fritas" -> query="papas fritas".
    - Ejemplo: "Como cocinar pollo al horno" -> query="pollo horno".

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

  // =========================================================
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
    const sliced = safe.slice(-10);

    // 2. Mapear el historial previo
    const history = (Array.isArray(sliced) ? sliced : []).map((msg) => ({
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

  // =========================================================
  // GENERAR RESPUESTA DE CHAT
  // =========================================================
  async generateChatResponse(
    systemInstruction: string,
    conversation: any[] = [],
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
        max_tokens: 1024,
        top_p: 1,
      });

      return (
        response.choices[0]?.message?.content ||
        "Lo siento, no pude procesar tu solicitud."
      );
    } catch (error: any) {
      console.error("Error en Groq Service:", error);

      if (error.status === 413)
        return "Error: El historial es demasiado largo.";
      if (error.status === 429)
        return "Error: Demasiadas peticiones (Límite de Groq alcanzado).";

      return "Hubo un problema técnico con el motor de IA.";
    }
  }
}
