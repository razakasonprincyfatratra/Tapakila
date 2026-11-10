import { Router } from "express";
import { getProfile, updateProfile } from "../controllers/user.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/me", authMiddleware, getProfile);
router.patch("/me", authMiddleware, updateProfile);

export default router;