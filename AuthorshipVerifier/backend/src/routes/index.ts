import { Router } from "express";
import authRouter from "./auth.routes";
import documentRouter from "./document.routes";

const router = Router();

router.use("/auth", authRouter);
router.use("/documents", documentRouter);

export default router;