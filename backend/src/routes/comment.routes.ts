import { Router } from "express";
import { deleteComment } from "../controllers/comment.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

router.delete("/:commentId", authMiddleware, deleteComment);

export default router;