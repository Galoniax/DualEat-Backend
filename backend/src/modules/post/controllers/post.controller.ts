import { Request, Response } from "express";
import { PostService } from "../services/post.service";

import { uploadFiles, deleteFiles } from "@/core/config/supabase";

import { RecipeDTO } from "@/shared/interfaces/dto/recipe.dto";
import { PostDTO } from "@/shared/interfaces/dto/post.dto";

import { optimize } from "@/shared/utils/sharp";

export class PostController {
  constructor(private postService: PostService) {}

  // OBTENER TODOS LOS POSTS
  // =========================================================
  getAll = async (req: Request, res: Response) => {
    try {
      const { page } = req.query;
      const user_id = (req as any).user?.id;

      const result = await this.postService.getAll(
        Number(page),
        String(user_id),
      );

      if (!result) {
        return res
          .status(404)
          .json({ success: false, message: "Posts no encontrados" });
      }

      return res.status(200).json({ success: true, ...result });
    } catch (e: any) {
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Error interno del servidor",
      });
    }
  };

  // OBTENER POSTS DE UNA COMUNIDAD
  // =========================================================
  getCommunityPosts = async (req: Request, res: Response) => {
    const { page } = req.query as { page: string };
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
      );

      if (!posts) {
        return res.status(404).json({
          success: false,
          message: "Posts de la comunidad no encontrados",
        });
      }

      return res.status(200).json({ success: true, ...posts });
    } catch (e: any) {
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Error interno del servidor",
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
    } catch (e: any) {
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Error interno del servidor",
      });
    }
  };

  // CREAR POST CON RECETA (OPCIONAL)
  // =========================================================
  create = async (req: Request, res: Response) => {
    const { post, recipe } = req.body as { post: PostDTO; recipe?: RecipeDTO };

    const user_id = (req as any).user?.id || req.body.user_id;

    try {
      const result = await this.postService.create(user_id, post, recipe);

      return res.status(201).json({
        success: true,
        data: result,
        message: recipe
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
  
      if (urls.length > 0) {
        deleteFiles(urls).catch((err) =>
          console.error("Error crítico al borrar imágenes huérfanas:", err),
        );
      }

      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Error interno del servidor",
      });
    }
  };

  // ELIMINAR POST
  // =========================================================
  delete = async (req: Request, res: Response) => {
    const { post_id } = req.params as { post_id: string };

    const user_id = (req as any).user?.id || req.body.user_id;

    if (!post_id) {
      return res.status(400).json({
        success: false,
        message: "Datos no validos",
      });
    }

    try {
      const result = await this.postService.delete(
        String(post_id),
        String(user_id),
      );

      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Post no encontrado",
        });
      }

      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Error interno del servidor",
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
        main_image?: string;
      } = {};

      console.log(files);

      if (files["post_images"] && files["post_images"].length > 0) {
        const optimized = await optimize(files["post_images"]);

        const urls = await uploadFiles(optimized, "posts", "");
        uploadedUrls.post_images = Array.isArray(urls) ? urls : [urls];
      }

      if (files["main_image"] && files["main_image"].length > 0) {
        const optimized = await optimize(files["main_image"]);

        const url = await uploadFiles(optimized[0], "recipes", "recipe_main");
        uploadedUrls.main_image = url as string;
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
