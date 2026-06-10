import { Request, Response, NextFunction } from "express";
import { ZodObject, ZodError } from "zod";

export const validateBody = (schema: ZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync(req.body);

      req.body = parsed;
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: e.issues[0].message,
        });
      }
      next(e);
    }
  };
};
