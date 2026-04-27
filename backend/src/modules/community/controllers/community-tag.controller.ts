import { Request, Response } from "express";
import { CommunityTagService } from "../services/community-tag.service";
import { TagCategoryService } from "../services/tag-category.service";

export class CommunityTagController {
  constructor(
    private communityTagService: CommunityTagService,
    private tagCategoryService: TagCategoryService,
  ) {}

  // =========================================================
  // OBTENER TODAS LAS CATEGORIAS DE ETIQUETAS
  // =========================================================
  getAllCategories = async (req: Request, res: Response) => {
    try {
      const tagCategories = await this.tagCategoryService.getAllTagCategories();

      if (tagCategories.length === 0)
        return res
          .status(404)
          .json({ success: false, message: "No se encontraron categorias" });

      return res.status(200).json({ success: true, data: tagCategories });
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: "Error al obtener categorias de tags",
      });
    }
  };

  // =========================================================
  // OBTENER TODAS LAS ETIQUETAS
  // =========================================================
  getAllTags = async (req: Request, res: Response) => {
    try {
      const tags = await this.communityTagService.getAllCommunityTags();

      if (!tags || tags.length === 0)
        return res
          .status(404)
          .json({ success: false, message: "No se encontraron etiquetas" });

      return res.status(200).json({ success: true, data: tags });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error al obtener las etiquetas" });
    }
  };

  // =========================================================
  // CREAR ETIQUETA (POST)
  // =========================================================
  create = async (req: Request, res: Response) => {
    const { data } = req.body;
    try {
      const tag = await this.communityTagService.createCommunityTag(data);

      if (!tag) {
        return res
          .status(404)
          .json({ success: false, message: "Error al crear la etiqueta" });
      }

      return res.status(201).json({ success: true, data: tag });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error al crear la etiqueta" });
    }
  };

  // =========================================================
  // OBTENER ETIQUETAS POR ID DE CATEGORIA
  // =========================================================
  getByCategoryId = async (req: Request, res: Response) => {
    const { category_id } = req.params;
    try {
      const tag = await this.communityTagService.getByCategoryId(
        Number(category_id),
      );
      if (tag) {
        return res.status(200).json({ success: true, data: tag });
      } else {
        return res
          .status(404)
          .json({ success: false, message: "Etiqueta no encontrada" });
      }
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error al obtener la etiqueta" });
    }
  };

  // =========================================================
  // ACTUALIZAR ETIQUETA
  // =========================================================
  update = async (req: Request, res: Response) => {
    const { id, data } = req.body;
    try {
      const updatedTag = await this.communityTagService.updateCommunityTag(
        id,
        data,
      );
      if (updatedTag) {
        return res.status(200).json({ success: true, data: updatedTag });
      } else {
        return res
          .status(404)
          .json({ success: false, message: "Etiqueta no encontrada" });
      }
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error al actualizar la etiqueta" });
    }
  };

  // =========================================================
  // ELIMINAR ETIQUETA
  // =========================================================
  delete = async (req: Request, res: Response) => {
    const { id } = req.body;
    try {
      const deleted = await this.communityTagService.deleteCommunityTag(id);
      if (deleted) {
        return res.status(204).send();
      } else {
        return res
          .status(404)
          .json({ success: false, message: "Etiqueta no encontrada" });
      }
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: "Error al eliminar la etiqueta" });
    }
  };
}
