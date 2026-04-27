import { Request, Response } from "express";
import { VoteService } from "./vote.service";
import { ContentType, VoteType } from "@prisma/client";

export class VoteController {
  constructor(private voteService: VoteService) {}

  // =========================================================
  // CREAR VOTO
  // =========================================================
  create = async (req: Request, res: Response) => {
    const { type, content_id, content_type } = req.body as {
      type: VoteType;
      content_id: string;
      content_type: ContentType;
    };
    const user_id = (req as any).user?.id || req.body.user_id;

    if (!type || !content_id || !content_type) {
      return res
        .status(400)
        .json({ success: false, message: "Datos incompletos" });
    }

    try {
      const vote = await this.voteService.create(
        type,
        content_id,
        content_type,
        user_id,
      );

      if (vote.action === "deleted") {
        return res.status(204).json({ success: true });
      }
      if (vote.action === "updated") {
        return res.status(200).json({ success: true, data: vote });
      } else {
        return res.status(201).json({ success: true, data: vote });
      }
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message });
    }
  };
}
