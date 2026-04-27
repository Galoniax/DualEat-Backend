import { Request, Response } from "express";
import { RecipeService } from "../../recipe/recipe.service";

import ChatSessionService from "../services/chat-session.service";
import SessionService from "../../../core/services/session.service";

import { AIService } from "../services/ai.service";

import { ChatSession } from "src/shared/interfaces/types/chat.types";

interface Recipe {
  id: string;
  name: string;
  total_time: number | null;
  main_image: string;
  user: {
    id: string;
    slug: string;
    name: string;
    avatar_url: string | null;
  };
  _count: {
    ingredients: number;
    steps: number;
    posts: number;
  };
}

interface PaginatedRecipeResponse {
  data: Recipe[];
  pagination: {
    page: number;
    hasMore: boolean;
  };
}

export class ChatController {
  private readonly chatSessionService = ChatSessionService.getInstance();
  private readonly sessionService = SessionService.getInstance();

  private readonly aiService = AIService.getInstance();

  constructor(private recipeService: RecipeService) {}

  // =========================================================
  // REALIZAR PREGUNTA A GROQ
  // =========================================================
  ask = async (req: Request, res: Response) => {
    const { question, conversation, chat_id, recipe_id } = req.body;
    const user_id = (req as any).user?.id || req.body.user_id;

    // TODO: Implementar sistema de créditos para limitar el uso de la IA / Suscripción

    try {
      let recipes: PaginatedRecipeResponse | null = null;
      let intent: any = null;

      let context = `Eres "DualChef", el asistente inteligente y amigable de la app DualEat.

      Tus directrices de personalidad y comportamiento:
      1. Tono conversacional: Sé cálido, natural y empático. Si el usuario te saluda casualmente (ej: "Todo bien?"), respóndele de manera relajada y humana antes de ofrecer tus servicios.
      2. No seas repetitivo: Evita usar la misma frase de bienvenida ("¡Bienvenido a DualEat!") en cada interacción. Varía tus respuestas según el contexto de la charla.
      3. Experiencia culinaria: Si el usuario pregunta por comida, muestra entusiasmo y conocimiento. 
      4. Temas generales: Puedes hablar de cualquier tema, pero siempre intenta, de manera sutil y divertida, relacionarlo con la comida o sugerir algo delicioso. (ej: "¡Todo bien por aquí! Con tanta charla me dio hambre, ¿a ti no?").
      
      REGLA DE FORMATO OBLIGATORIA: 
      - SIEMPRE usa Markdown para formatear tu respuesta. 
      - Usa negritas (**texto**) para resaltar ingredientes o nombres importantes.
      - Usa listas con viñetas (-) o números (1.) para pasos.
      - Usa saltos de línea (\\n\\n) para separar párrafos.`;

      if (recipe_id) {
        const fullRecipe = await this.recipeService.getById(recipe_id);

        if (fullRecipe) {
          const recipeData = JSON.stringify(fullRecipe);
          context += `
            ACTUALMENTE ESTÁS AYUDANDO AL USUARIO A PREPARAR ESTA RECETA: 
            ${recipeData}
            
            Reglas para este modo:
            1. Responde a su pregunta ("${question}") basándote estrictamente en los pasos y detalles de esta receta.
            2. Si el usuario pregunta por un ingrediente o paso, búscalo en la información provista.
            3. Actúa como si estuvieras a su lado en la cocina guiándolo.
          `;
        }
      } else {
        intent = await this.aiService.detectIntent(question);

        if (intent.type === "SEARCH" && intent.query) {
          recipes = await this.recipeService.searchRecipes(intent.query, 1);

          console.log("Recetas encontradas:", recipes);

          if (recipes && recipes.data.length > 0) {
            const data = JSON.stringify(recipes.data);
            context += `
            El usuario busca comida relacionada con "${intent.query}".
            En nuestra base de datos TENEMOS estas opciones: ${data}.
            Sugiérelas amablemente y pregúntale cuál le apetece preparar. 
            NO inventes recetas que no estén en esta lista.
          `;
          } else {
            context += `
            El usuario buscó "${intent.query}" pero NO hay resultados en la base de datos.
            Dile que no hay recetas de ese estilo por ahora, pero invítalo a buscar otra cosa (ej: pollo, pasta, vegano).
          `;
          }
        } else if (intent.type === "CHAT") {
          context += `
           El usuario está conversando de manera general.
           Responde a su mensaje ("${question}") de forma natural y amigable.
           Si te hace una pregunta, respóndela. Si solo saluda, devuélvele el saludo con buena energía y pregúntale cómo le está yendo en su día o qué tiene pensado comer hoy.
         `;
        }
      }

      const response = await this.aiService.generateChatResponse(
        question,
        conversation,
        context,
      );

      let title = "";
      let c_id = chat_id;

      if (!chat_id) {
        title =
          question.length > 30 ? question.substring(0, 30) + "..." : question;
        c_id = this.sessionService.generateUniqueId();
      }

      const chat: ChatSession = {
        chat_id: c_id,
        title,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        messages: [
          {
            text: question,
            role: "USER",
          },
          {
            text: response,
            role: "IA",
          },
        ],
        recipe_id: recipe_id || null,
      };

      console.log("Recetas: ", recipes?.data);

      res.status(200).json({
        success: true,
        data: {
          chat,
          recipes: recipes?.data || null,
          search_query: intent.type === "SEARCH" ? intent.query : null,
        },
      });

      this.chatSessionService.addMessage(user_id, chat).catch((e) => {
        console.error("Error crítico guardando en DB el historial de chat:", e);
      });
    } catch (e) {
      console.error("Error en ask:", e);
      return res
        .status(500)
        .json({ success: false, message: "Error al generar respuesta" });
    }
  };

  // =========================================================
  // OBTENER CHAT POR ID
  // =========================================================
  getById = async (req: Request, res: Response) => {
    const { chat_id } = req.params;
    const user_id = (req as any).user?.id || req.body.user_id;

    try {
      const chat = await this.chatSessionService.getById(
        String(user_id),
        String(chat_id),
      );

      if (!chat) {
        return res
          .status(404)
          .json({ success: false, message: "Chat no encontrado" });
      }

      return res.status(200).json({ success: true, data: chat });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error al obtener el chat",
      });
    }
  };

  // =========================================================
  // OBTENER CHATS DEL USUARIO
  // =========================================================
  getUserChats = async (req: Request, res: Response) => {
    const user_id = (req as any).user?.id || req.body.user_id;
    const { search } = req.query;

    try {
      const chats = await this.chatSessionService.getUserChats(
        String(user_id),
        String(search),
      );

      if (!chats) {
        return res
          .status(404)
          .json({ success: false, message: "No se encontraron chats" });
      }

      return res.status(200).json({ success: true, data: chats });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error al obtener los chats",
      });
    }
  };

  // =========================================================
  // EDITAR TITULO DEL CHAT
  // =========================================================
  editTitle = async (req: Request, res: Response) => {
    const { chat_id } = req.params;
    const { title } = req.body;

    const user_id = (req as any).user?.id || req.body.user_id;

    if (!chat_id || !title) {
      return res
        .status(400)
        .json({ success: false, message: "Faltan datos requeridos" });
    }

    try {
      const chat = await this.chatSessionService.editTitle(
        String(chat_id),
        String(user_id),
        String(title),
      );

      if (!chat) {
        return res
          .status(404)
          .json({ success: false, message: "Chat no encontrado" });
      }

      return res.status(200).json({ success: true, data: chat });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error al editar el chat",
      });
    }
  };

  // =========================================================
  // ELIMINAR CHAT
  // =========================================================
  deleteChat = async (req: Request, res: Response) => {
    const { chat_id } = req.params;
    const user_id = (req as any).user?.id || req.body.user_id;
    try {
      const chat = await this.chatSessionService.deleteChat(
        String(chat_id),
        String(user_id),
      );

      if (!chat) {
        return res
          .status(404)
          .json({ success: false, message: "Chat no encontrado" });
      }

      return res.status(204).send();
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error al eliminar el chat",
      });
    }
  };

  // =========================================================
  // ELIMINAR TODOS LOS CHATS DEL USUARIO
  // =========================================================
  deleteAllChats = async (req: Request, res: Response) => {
    const user_id = (req as any).user?.id || req.body.user_id;
    try {
      const chats = await this.chatSessionService.deleteAllChats(
        String(user_id),
      );

      if (!chats) {
        return res
          .status(404)
          .json({ success: false, message: "No se encontraron chats" });
      }

      return res.status(204).send();
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error al eliminar los chats",
      });
    }
  };
}
