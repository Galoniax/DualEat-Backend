import { Request, Response } from "express";
import { SearchService } from "../services/search.service";

export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // OBTENER RESULTADOS GLOBALES DE UNA BUSQUEDA
  // =========================================================
  getGlobal = async (req: Request, res: Response) => {
    const { query, tab, page, community_id } = req.query as {
      query: string;
      tab: "posts" | "recipes" | "comments" | "communities";
      page: string;
      community_id?: string;
    };

    console.log(
      "query",
      query,
      "tab",
      tab,
      "page",
      page,
      "community_id",
      community_id,
    );

    if (typeof page !== "string" || isNaN(Number(page))) {
      return res.status(400).json({
        success: false,
        message: "El número de página no es válido.",
      });
    }

    if (!query || !tab) {
      return res.status(400).json({
        success: false,
        message: "Datos invalidos",
      });
    }
    try {
      const result = await this.searchService.getGlobal(
        query,
        tab,
        Number(page),
        community_id,
      );

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        message: e.message || "Error al buscar",
      });
    }
  };
}
