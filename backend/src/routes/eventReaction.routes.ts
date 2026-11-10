import { Router } from "express";
import { getReactions, toggleReaction } from "../controllers/reaction.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router({ mergeParams: true });

router.get("/", getReactions);
router.post("/", authMiddleware, toggleReaction);

export default router;