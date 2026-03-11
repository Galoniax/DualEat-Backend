import { Request, Response } from "express";

import { ollamaConfig } from "../../core/config/config";
import { RecipeService } from "../recipe/recipe.service";

import ChatSessionService from "./chat-session.service";
import SessionService from "../../core/services/session.service";

import { extractJSON } from "../../shared/utils/aiHelpers";

import axios from "axios";

export class ChatController {
  private readonly chatSessionService = ChatSessionService.getInstance();

  private readonly sessionService = SessionService.getInstance();

  constructor(private recipeService: RecipeService) {}

  /** POST /api/chat/ask ASK OLLAMA */
  askOllama = async (req: Request, res: Response) => {
    const { question, page, conversation, chat_id } = req.body;

    const user_id = (req as any).user?.id;

    const intentPrompt = `
    Eres el cerebro de la app de cocina DualEat. Tu trabajo es clasificar la intención del usuario.
    Analiza este mensaje: "${question}"
    
    Responde ÚNICAMENTE con un objeto JSON con este formato exacto:
    {
      "type": "SEARCH" | "CHAT",
      "query": string | null
    }
    
    REGLAS:
    - Si el usuario busca recetas, ingredientes o dice "tengo hambre", type es "SEARCH" y query es la palabra clave (ej: "pollo", "vegano", "rápido").
    - Si el usuario saluda o pregunta cosas generales (ej: "¿Cómo cortar cebolla?"), type es "CHAT" y query es null.
    - NO añadas texto fuera del JSON.
  `;

    try {
      const model = "llama3.2:1b";

      let messages = [
        ...(Array.isArray(conversation) ? conversation : []),
        { role: "user", content: question },
      ];

      const intentResponse = await axios.post(`${ollamaConfig.host}/api/chat`, {
        model: model,
        prompt: intentPrompt,
        stream: false,
      });

      const intentText = intentResponse.data.response;
      const intentAction = extractJSON(intentText);

      console.log("Intención detectada:", intentAction);

      let finalSystemContext = "Eres un asistente de cocina amable y experto.";

      if (
        intentAction &&
        intentAction.type === "SEARCH" &&
        intentAction.query
      ) {
        console.log(`🔎 Buscando en DB: ${intentAction.query}`);

        const recipes = await this.recipeService.searchRecipes(
          intentAction.query,
        );

        if (recipes.length > 0) {
          // Inyectamos los datos reales en el contexto de la IA
          const recipesData = JSON.stringify(recipes);
          finalSystemContext += `
          El usuario buscó "${intentAction.query}".
          He consultado la base de datos y encontré estas recetas: ${recipesData}.
          Usa esta información para responder al usuario. Recomienda la mejor opción.
          No inventes recetas que no estén en esta lista.
        `;
        } else {
          finalSystemContext += `
          El usuario buscó "${intentAction.query}" pero NO encontré nada en la base de datos.
          Dile amablemente que no hay resultados y sugiere que busque otra cosa.
        `;
        }
      }

      const finalResponse = await axios.post(`${ollamaConfig.host}/api/chat`, {
        model: model,
        prompt: `${finalSystemContext}\n\nUsuario: ${question}
      \nAsistente:`,
        stream: false,
      });

      let title = "";
      let finalChatId = chat_id;
      let exists = !!chat_id;

      // 2. Generar Título y nuevo ChatId si es una conversación nueva
      if (!chat_id) {
        // Generar título de forma síncrona (requerido para enviarlo en la respuesta)
        title = await this.chatSessionService.generateChatTitle(question);
        finalChatId = this.sessionService.generateUniqueId();
        exists = false;
      }

      // 3. Enviar la respuesta al cliente INMEDIATAMENTE
      res.json({
        success: true,
        title: title,
        chatId: finalChatId,
        comment: finalResponse.data.response,
      });

      // 4. Guardar el historial de conversación de forma ASÍNCRONA
      this.chatSessionService
        .addMessages(
          finalChatId,
          user_id,
          [
            {
              role: "USER",
              text: question,
            },
            {
              role: "IA",
              text: finalResponse.data.response,
            },
          ],
          title,
          exists,
        )
        .catch((err: any) => {
          console.error(
            "Error guardando mensajes de chat de forma asíncrona:",
            err,
          );
        });

      return;
    } catch (error: any) {
      if (!res.headersSent) {
        console.error("Error en askOllama:", error);
        res.status(500).json({ success: false, error: error.message });
      } else {
        console.error("Error posterior al envío de respuesta:", error);
      }
    }
  };

  /** POST /api/chat/ask-recipe ASK RECIPE */
  askRecipe = async (req: Request, res: Response) => {
    // puede tener un chatId si es una conversación existente
    const { question, recipe_id, conversation, chat_id } = req.body;

    const user_id = (req as any).user?.id;

    try {
      if (!recipe_id || typeof question !== "string") {
        return res.status(400).json({
          success: false,
          error: "Datos inválidos (recipe_id o question).",
        });
      }

      // Determinar si es un chat existente o el primer mensaje (aunque idealmente siempre debería tener chatId aquí)
      const finalChatId = chat_id || this.sessionService.generateUniqueId();
      const exists = !!chat_id;

      const recipe = await this.recipeService.getRecipeById(recipe_id);
      if (!recipe) {
        return res
          .status(404)
          .json({ success: false, comment: "Receta no encontrada" });
      }

      // --- Preparación del Contexto para Ollama ---
      const recipeContext = [
        `Nombre: ${recipe.name}`,
        `Descripción: ${recipe.description || "Sin descripción"}`,
        `Ingredientes: ${(recipe.ingredients || [])
          .map(
            (ing: any) =>
              `${ing.ingredient?.name || ing.name} (${ing.quantity || ""} ${ing.unit_of_measure?.name || ""})`,
          )
          .join(", ")}`,
        `Pasos: ${(recipe.steps || [])
          .map((s: any, i: number) => `${i + 1}) ${s.description}`)
          .join(" ")}`,
      ].join("\n");

      const systemMessage = `Sos un asistente de cocina de DualEat.
        REGLA CRÍTICA: Solo usá la información de la receta si el usuario pregunta EXPLÍCITAMENTE sobre ella (ingredientes, pasos, tiempos, sustituciones, etc.).
        
        Si el usuario:
        - Saluda o pregunta cosas generales (nombre, cómo estás, etc.) → Respondé brevemente SIN mencionar la receta
        - Pregunta sobre la receta → Usá la info de abajo para responder de forma concisa
        
        Receta disponible:
        ${recipeContext}`;

      const messages = [
        { role: "system", content: systemMessage },
        ...(Array.isArray(conversation) ? conversation : []),
        { role: "user", content: question },
      ];

      // --- Llamada a Ollama ---
      const ollamaResponse = await axios.post(`${ollamaConfig.host}/api/chat`, {
        model: "llama3.2:1b",
        messages,
        stream: false,
        temperature: 0.3,
      });

      const iaResponse =
        ollamaResponse.data.message?.content || "Sin respuesta";

      const title = "Receta: " + recipe.name;

      res.status(200).json({
        success: true,
        title,
        chatId: finalChatId,
        comment: iaResponse,
      });

      // 4. Guardar la sesión de forma ASÍNCRONA (Añadir el activeRecipeId)
      this.chatSessionService
        .addMessages(
          finalChatId,
          user_id,
          [
            { role: "USER", text: question },
            { role: "IA", text: iaResponse },
          ],
          title,
          exists,
          recipe.id,
        )
        .catch((err: any) => {
          console.error(
            "Error guardando mensajes de chat de forma asíncrona:",
            err,
          );
        });

      return;
    } catch (error: any) {
      if (!res.headersSent) {
        console.error("Error en askRecipe:", error);
        res.status(500).json({ success: false, error: error.message });
      } else {
        console.error(
          "Error posterior al envío de respuesta (asíncrono):",
          error,
        );
      }
    }
  };

  // -------------------------------------------------------------

  /** GET /api/chat/session GET CHAT SESSION */
  getChatSession = async (req: Request, res: Response) => {
    const { chat_id } = req.query;
    const user_id = (req as any).user?.id;

    console.log("HOAAAAAA", user_id + "  /  " + chat_id);
    try {
      const chatSession = await this.chatSessionService.getChatDataById(
        String(user_id),
        String(chat_id),
      );
      res.status(200).json({ success: true, data: chatSession });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

  /** GET /api/chat/all-sessions GET USER CHATS */
  getChatSessions = async (req: Request, res: Response) => {
    const user_id = (req as any).user?.id;
    try {
      const chatSessions = await this.chatSessionService.getUserChats(
        String(user_id),
      );
      res.status(200).json({ success: true, data: chatSessions });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

  /** PUT /api/chat/edit EDIT USER TITLE */
  editChatSession = async (req: Request, res: Response) => {
    const { chat_id, title } = req.body;
    const user_id = (req as any).user?.id;

    try {
      const chatSession = await this.chatSessionService.editTitle(
        String(chat_id),
        String(user_id),
        String(title),
      );

      if (!chatSession) {
        return res
          .status(400)
          .json({ success: false, error: "Error editando título del chat." });
      }

      res.status(200).json({ success: true, data: chatSession });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

  /** DELETE /api/chat/session DELETE USER CHAT */
  deleteChatSession = async (req: Request, res: Response) => {
    const { chat_id } = req.query;
    const user_id = (req as any).user?.id;

    try {
      if (!chat_id) {
        return res.status(400).json({
          success: false,
          error: "Datos inválidos (chatId).",
        });
      }

      const result = await this.chatSessionService.deleteChat(
        chat_id as string,
        user_id,
      );

      if (result) {
        res.status(200).json({ success: true });
      } else {
        res.status(400).json({ success: false, error: "Chat no encontrado." });
      }
    } catch (error: any) {
      if (!res.headersSent) {
        console.error("Error en deleteChatSession:", error);
        res.status(500).json({ success: false, error: error.message });
      } else {
        console.error(
          "Error posterior al envío de respuesta (asíncrono):",
          error,
        );
      }
    }
  };

  /** DELETE /api/chat/all-sessions DELETE ALL USER CHATS */
  deleteAllChatSessions = async (req: Request, res: Response) => {
    const user_id = (req as any).user?.id;
    try {
      await this.chatSessionService.deleteAllUserChats(String(user_id));
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  };
}
