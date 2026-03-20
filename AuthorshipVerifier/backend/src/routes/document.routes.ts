import { Router } from "express";
import {
  createDocument,
  getDocuments
} from "../controllers/document.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const documentRouter = Router();

documentRouter.get("/", authMiddleware, getDocuments);
documentRouter.post("/", authMiddleware, createDocument);

export default documentRouter;