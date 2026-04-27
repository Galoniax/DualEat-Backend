import { Request, Response } from "express";
import { PostService } from "../services/post.service";

import { uploadFiles, deleteFiles } from "../../../core/config/supabase";

import { RecipeDTO } from "../../../shared/interfaces/dto/recipe.dto";
import { PostDTO } from "../../../shared/interfaces/dto/post.dto";

import sanitizeHtml from "sanitize-html";
import { optimize } from "../../../shared/utils/sharp";

export class PostController {
  constructor(private postService: PostService) {}


  // OBTENER TODOS LOS POSTS
  // =========================================================
  getAll = async (req: Request, res: Response) => {
    try {
      const { page } = req.query;
      const user_id = (req as any).user?.id;

      const result = await this.postService.getAllPosts(
        Number(page),
        String(user_id),
      );

      if (!result) {
        return res
          .status(404)
          .json({ success: false, message: "Posts no encontrados" });
      }

      return res.status(200).json({ success: true, ...result });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };

  // OBTENER POSTS DE UNA COMUNIDAD
  // =========================================================
  getCommunityPosts = async (req: Request, res: Response) => {
    const { page, title } = req.query as { page: string; title?: string };
    const { community_id } = req.params as { community_id: string };

    const user_id = (req as any).user?.id || req.query.user_id;

    if (typeof page !== "string" || isNaN(Number(page))) {
      return res.status(400).json({
        success: false,
        message: "El número de página no es válido.",
      });
    }

    if (!community_id) {
      return res
        .status(400)
        .json({ success: false, message: "Id no encontrado" });
    }

    try {
      const posts = await this.postService.getCommunityPosts(
        Number(page),
        String(community_id),
        String(user_id),
        String(title),
      );

      if (!posts) {
        return res.status(404).json({
          success: false,
          message: "Posts de la comunidad no encontrados",
        });
      }

      return res.status(200).json({ success: true, ...posts });
    } catch (e: any) {
      return res.status(400).json({
        success: false,
        message: e.message || "Error al obtener los posts",
      });
    }
  };

  // OBTENER POST POR ID
  // =========================================================
  getById = async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const user_id = (req as any).user?.id || req.body.user_id;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Id no encontrado" });
    }

    try {
      const post = await this.postService.getById(String(id), String(user_id));
      if (!post) {
        return res
          .status(404)
          .json({ success: false, message: "Post no encontrado" });
      }

      return res.status(200).json({ success: true, data: post });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };

  // CREAR POST CON RECETA (OPCIONAL)
  // =========================================================
  create = async (req: Request, res: Response) => {
    const { post, recipe } = req.body as { post: PostDTO; recipe?: RecipeDTO };

    const user_id = (req as any).user?.id || req.body.user_id;

    let Post: PostDTO;
    let Recipe: RecipeDTO | undefined;

    const sanitize = sanitizeHtml(post.content, {
      allowedTags: ["b", "em", "strong", "p", "h1", "h2", "ul", "ol", "li"],
    });

    try {
      Post = {
        title: String(post.title).trim(),
        content: sanitize,
        image_urls: post.image_urls,
        user_id: String(user_id),
        community_id: String(post.community_id),
      };

      if (recipe) {
        const steps = recipe.steps?.map((step: any) => ({
          step_number: parseInt(step.step_number, 10) || 0,
          description: step.description,
          image_url: step.image_url || null,
          estimated_time: step.estimated_time
            ? parseInt(step.estimated_time, 10)
            : null,
        }));

        const ingredients = recipe.ingredients?.map((ingredient: any) => ({
          ingredient_id: parseInt(ingredient.ingredient_id, 10) || 0,
          quantity: String(ingredient.quantity).trim(),
          unit: ingredient.unit,
          notes: ingredient.notes || null,
        }));

        Recipe = {
          name: String(recipe.name).trim(),
          description: String(recipe.description).trim(),
          main_image: recipe.main_image,
          total_time: Number(recipe.total_time) || 0,
          user_id: String(user_id),
          ingredients: ingredients,
          steps: steps,
        };
      }

      const result = await this.postService.create(Post, Recipe);

      if (!result) {
        throw new Error("Error al crear el post");
      }

      return res.status(201).json({
        success: true,
        ...result,
        message: Recipe
          ? "Post y receta creados exitosamente"
          : "Post creado exitosamente",
      });
    } catch (e: any) {
      const urls: string[] = [];

      if (post?.image_urls?.length) {
        urls.push(...post.image_urls);
      }
      if (recipe?.main_image) {
        urls.push(recipe.main_image);
      }
      if (recipe?.steps?.length) {
        recipe.steps.forEach((step) => {
          if (step.image_url) urls.push(step.image_url);
        });
      }

      if (urls.length > 0) {
        deleteFiles(urls).catch((err) =>
          console.error("Error crítico al borrar imágenes huérfanas:", err),
        );
      }

      return res.status(500).json({
        success: false,
        message: "Error interno del servidor. No se pudo crear la publicación.",
      });
    }
  };

  // SUBIR IMÁGENES
  // =========================================================
  upload = async (req: Request, res: Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files || Object.keys(files).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No se recibieron archivos." });
    }

    try {
      const uploadedUrls: {
        post_images?: string[];
        recipe_main_image?: string;
        step_images?: string[];
      } = {};

      console.log(files);

      if (files["post_images"] && files["post_images"].length > 0) {
        const optimized = await optimize(files["post_images"]);

        const urls = await uploadFiles(optimized, "posts", "");
        uploadedUrls.post_images = Array.isArray(urls) ? urls : [urls];
      }

      if (files["recipe_main_image"] && files["recipe_main_image"].length > 0) {
        const optimized = await optimize(files["recipe_main_image"]);

        const url = await uploadFiles(optimized[0], "recipes", "recipe_main");
        uploadedUrls.recipe_main_image = url as string;
      }

      if (files["step_images"] && files["step_images"].length > 0) {
        const optimized = await optimize(files["step_images"]);

        const urls = await uploadFiles(optimized, "recipes", "steps");
        uploadedUrls.step_images = Array.isArray(urls) ? urls : [urls];
      }

      return res.status(200).json({
        success: true,
        urls: uploadedUrls,
      });
    } catch (e) {
      console.error("Error subiendo archivos a Supabase:", e);
      return res.status(500).json({
        success: false,
        message: "Error interno al subir las imágenes.",
      });
    }
  };
}
