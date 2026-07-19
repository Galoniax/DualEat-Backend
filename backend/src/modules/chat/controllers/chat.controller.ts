import { Request, Response } from "express";
import { RecipeService } from "@/modules/recipe/recipe.service";

import ChatSessionService from "../services/chat-session.service";
import SessionService from "@/core/services/session.service";

import { AIService } from "../services/ai.service";

import { ChatSession } from "@/shared/interfaces/types/chat.types";
import { RecipeStep } from "@prisma/client";

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

  // REALIZAR PREGUNTA A GROQ
  // =========================================================
  ask = async (req: Request, res: Response) => {
    const { question, chat_id, ingredients } = req.body;
    const user_id = (req as any).user?.id || req.body.user_id;

    if (!question) {
      return res
        .status(400)
        .json({ success: false, message: "La pregunta es requerida." });
    }

    let chat: ChatSession = {
      chat_id: chat_id || this.sessionService.generateUniqueId(),
      title: !chat_id
        ? question.length > 30
          ? question.substring(0, 30) + "..."
          : question
        : "",
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      messages: [],
      recipe_id: null,
    };

    if (chat_id) {
      chat = await this.chatSessionService.getById(
        String(user_id),
        String(chat_id),
      );
    }

    chat.messages.push({
      role: "USER",
      text: question,
    });

    try {
      let recipes: PaginatedRecipeResponse | null = null;
      let intent: any = null;

      let context = `Eres DualChef, chef amigable. Sé cálido, natural, varía tus respuestas. Tienes amplio conocimiento gastronómico. Si el tema no es comida, responde pero intenta relacionarlo con cocina sutilmente. Formato: Markdown, listas con - o 1., sin links/imágenes/emojis.`;

      intent = await this.aiService.detectIntent(question);

      const hasIngredients = ingredients && ingredients.length > 0;

      if (intent.type === "SEARCH" || hasIngredients) {
        const searchQuery = intent.query || question;
        recipes = await this.recipeService.searchRecipes(
          searchQuery,
          ingredients,
          1,
        );

        if (recipes && recipes.data.length > 0) {
          const names = recipes.data.map((r: any) => r.name).join(", ");
          context += ` Recetas encontradas: ${names}. Sugiérelas y pregunta cuál prefiere. No inventes otras.`;
        } else {
          context += ` No hay recetas en la BD para "${question}". Responde con tu conocimiento culinario.`;
        }
      } else {
        context += `
         El usuario está conversando de manera general.
         Responde a su mensaje ("${question}") de forma natural y amigable.
         Si te hace una pregunta, respóndela. Si solo saluda, devuélvele el saludo con buena energía y pregúntale cómo le está yendo en su día o qué tiene pensado comer hoy.
       `;
      }

      if (chat.recipe_id) {
        const fullRecipe = await this.recipeService.getById(chat.recipe_id);

        if (fullRecipe) {
          const steps =
            fullRecipe.steps
              ?.map((s: RecipeStep) => `${s.step_number}. ${s.description}`)
              .join(" | ") || "";
          const ings =
            fullRecipe.ingredients
              ?.map((i: any) => i.ingredient?.name)
              .filter(Boolean)
              .join(", ") || "";
          context += ` Receta fijada: "${fullRecipe.name}". Ingredientes: ${ings}. Pasos: ${steps}. Guía al usuario sobre esta receta, pero no te limites si pregunta otra cosa.`;
        }
      }

      const response = await this.aiService.generateChatResponse(
        context,
        chat.messages.slice(-3, -1),
        question,
      );

      chat.messages.push({
        role: "IA",
        text: response,
      });

      res.status(200).json({
        success: true,
        data: {
          chat: {
            chat_id: chat.chat_id,
            title: chat.title,
            messages: chat.messages.slice(-2),
            recipe_id: chat.recipe_id,
            created_at: chat.createdAt,
            last_activity: chat.lastActivity,
          },
          recipes: recipes?.data || null,
          search_query: hasIngredients ? question : null,
        },
      });

      this.chatSessionService.addMessage(user_id, chat);
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error al generar respuesta",
      });
    }
  };

  // ACTUALIZAR CHAT CON RECETA
  // =========================================================
  updateRecipe = async (req: Request, res: Response) => {
    const { chat_id, recipe_id } = req.body;
    const user_id = (req as any).user?.id || req.body.user_id;

    if (!chat_id) {
      return res.status(400).json({
        success: false,
        message: "ID de chat requerido",
      });
    }

    try {
      let chat = await this.chatSessionService.getById(
        String(user_id),
        String(chat_id),
      );

      if (!chat) {
        return res
          .status(404)
          .json({ success: false, message: "Chat no encontrado" });
      }

      chat.recipe_id = recipe_id || null;
      chat.lastActivity = new Date().toISOString();

      await this.chatSessionService.addMessage(user_id, chat);

      return res.status(200).json({
        success: true,
        message: "Chat actualizado correctamente",
        data: chat.recipe_id,
      });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error al actualizar el chat",
      });
    }
  };

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

  // EDITAR TITULO DEL CHAT
  // =========================================================
  editTitle = async (req: Request, res: Response) => {
    const { chat_id } = req.params as { chat_id: string };
    const { title } = req.body as { title: string };

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

      return res.status(200).json({
        success: true,
        message: "Chat actualizado correctamente",
        data: chat,
      });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error al editar el chat",
      });
    }
  };

  // ELIMINAR CHAT
  // =========================================================
  delete = async (req: Request, res: Response) => {
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

  // ELIMINAR TODOS LOS CHATS DEL USUARIO
  // =========================================================
  deleteAll = async (req: Request, res: Response) => {
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
