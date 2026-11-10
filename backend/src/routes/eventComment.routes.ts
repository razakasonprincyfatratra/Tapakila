import { Router } from "express";
import { listComments, createComment } from "../controllers/comment.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router({ mergeParams: true });

router.get("/", listComments);
router.post("/", authMiddleware, createComment);

export default router;