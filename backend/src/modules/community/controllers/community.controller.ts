import { Request, Response } from "express";
import { CommunityService } from "../services/community.service";

import { supabaseAdmin, uploadFiles } from "../../../core/config/supabase";
import { CommunityTagService } from "../services/community-tag.service";
import { optimize } from "../../../shared/utils/sharp";
import { CommunityDTO } from "src/shared/interfaces/dto/community.dto";

export class CommunityController {
  constructor(
    private communityService: CommunityService,
    private tagService: CommunityTagService,
  ) {}

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
      const uploaded: {
        banner_url: string;
        image_url: string;
      } = {
        banner_url: "",
        image_url: "",
      };

      if (files["banner_url"] && files["banner_url"].length > 0) {
        const optimized = await optimize(files["banner_url"]);

        const url = await uploadFiles(optimized[0], "community", "");
        uploaded.banner_url = url as string;
      }

      if (files["image_url"] && files["image_url"].length > 0) {
        const optimized = await optimize(files["image_url"]);

        const url = await uploadFiles(optimized[0], "community", "");
        uploaded.image_url = url as string;
      }

      return res.status(200).json({
        success: true,
        urls: uploaded,
      });
    } catch (e: any) {
      return res.status(400).json({
        success: false,
        message: e.message || "No se pudieron subir los archivos",
      });
    }
  };

  // CREAR COMUNIDAD
  // =========================================================
  create = async (req: Request, res: Response) => {
    const { community } = req.body as { community: CommunityDTO };

    const user_id = (req as any).user?.id || req.body.user_id;

    if (
      !community.name ||
      !community.description ||
      !community.tags ||
      !community.image_url ||
      !community.banner_url
    ) {
      return res.status(400).json({
        success: false,
        message: "Todos los campos son obligatorios.",
      });
    }

    try {
      const result = await this.communityService.create(community, String(user_id));

      return res.status(201).json({ success: true, data: result });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error al crear la comunidad",
      });
    }
  };

  // UNIRSE A UNA COMUNIDAD
  // =========================================================
  joinLeave = async (req: Request, res: Response) => {
    const { community_id, join } = req.body as {
      community_id: string;
      join: boolean;
    };
    const user_id = (req as any).user?.id;

    try {
      const member = await this.communityService.joinLeave(
        String(user_id),
        String(community_id),
        join,
      );

      return res.status(200).json({
        success: true,
        data: member,
        message: join ? "Te uniste a la comunidad" : "Abandonaste la comunidad",
      });
    } catch (e: any) {
      return res.status(400).json({
        success: false,
        message: e.message || "No se pudo unir o abandonar la comunidad",
      });
    }
  };

  // OBTENER COMUNIDAD (by slug)
  // =========================================================
  getBySlug = async (req: Request, res: Response) => {
    const { community_slug } = req.params;
    const user_id = (req as any).user?.id || req.query.user_id;

    try {
      const community = await this.communityService.getBySlug(
        String(community_slug),
        String(user_id),
      );

      if (!community) {
        return res
          .status(404)
          .json({ success: false, message: "Comunidad no encontrada" });
      }

      return res.status(200).json({ success: true, data: community });
    } catch (e: any) {
      return res.status(400).json({
        success: false,
        message: e.message || "Error al obtener la comunidad",
      });
    }
  };

  // OBTENER COMUNIDAD (by name)
  // =========================================================
  getByName = async (req: Request, res: Response) => {
    const { name } = req.query as { name: string };

    if (!name || name.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "El parámetro 'name' es requerido" });
    }

    try {
      const community = await this.communityService.getByName(name);

      if (!community) {
        return res
          .status(404)
          .json({ success: false, message: "Comunidad no encontrada" });
      }

      res.status(200).json({ success: true, data: community });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  };

  // OBTENER COMUNIDADES DEL USUARIO
  // =========================================================
  getUserCommunities = async (req: Request, res: Response) => {
    const user_id = (req as any).user?.id || req.query.user_id;

    if (!user_id || typeof user_id !== "string") {
      return res.status(400).json({
        success: false,
        message: "El ID del usuario es inválido o no se proporcionó.",
      });
    }

    try {
      const result = await this.communityService.getUserCommunities(user_id);

      if (!result) {
        return res
          .status(404)
          .json({ success: false, message: "No se encontraron comunidades" });
      }
      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      return res.status(400).json({
        success: false,
        message: e.message || "No se pudo obtener las comunidades",
      });
    }
  };

  // OBTENER COMUNIDAD (by category)
  // =========================================================
  getByCategorySkeleton = async (req: Request, res: Response) => {
    const { category_id } = req.params;

    if (!category_id) {
      return res.status(400).json({
        success: false,
        message: "El ID de la categoría es inválido o no se proporcionó.",
      });
    }

    try {
      const tags = await this.tagService.getByCategoryId(Number(category_id));

      if (!tags || tags.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No se encontraron tags para la categoría",
        });
      }

      const communities = await Promise.all(
        tags.map(async (tag) => {
          const communities = await this.communityService.getByTagSkeleton(
            tag.id,
          );

          return {
            id: tag.id,
            name: tag.name,
            items: communities || [],
          };
        }),
      );

      return res.status(200).json({
        success: true,
        data: communities,
      });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error al obtener comunidades por tag",
      });
    }
  };

  // OBTENER COMUNIDAD (by tag) (PAGINATION)
  // =========================================================
  getByTag = async (req: Request, res: Response) => {
    const { tagId } = req.query;

    console.log(tagId);
    try {
      const communities = await this.communityService.getCommunitiesByTag(
        Number(tagId),
      );
      res.status(200).json({ success: true, data: communities });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  };
}
