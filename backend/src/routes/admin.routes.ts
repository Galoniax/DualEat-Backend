import { Router } from "express";
import { handleCreateBusinessUserAndLocal } from "../controllers/admin.controller";
import {
  handleGetLocals,
  handleGetLocalById,
  handleUpdateLocal,
  handleDeleteLocal,
} from "../controllers/local.controller";

const router = Router();

// Rutas para Negocios
router.post("/business", handleCreateBusinessUserAndLocal);

// Rutas para Locales
router.get("/locals", handleGetLocals);
router.get("/locals/:id", handleGetLocalById);
router.put("/locals/:id", handleUpdateLocal);
router.delete("/locals/:id", handleDeleteLocal);

export default router;
