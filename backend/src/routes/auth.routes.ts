import { Router } from "express";
import { register, login, me, googleLogin, facebookLogin } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, me);
router.post("/google", googleLogin);
router.post("/facebook", facebookLogin);

export default router;