import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import {
  applyAsOrganizer,
  getMyApplication,
  listApplications,
  approveApplication,
  rejectApplication,
} from "../controllers/organizer.controller.js";

const router = Router();

router.post("/apply", authMiddleware, applyAsOrganizer);
router.get("/applications/me", authMiddleware, getMyApplication);
router.get("/applications", authMiddleware, requireRole("ADMIN"), listApplications);
router.patch("/applications/:id/approve", authMiddleware, requireRole("ADMIN"), approveApplication);
router.patch("/applications/:id/reject", authMiddleware, requireRole("ADMIN"), rejectApplication);

export default router;