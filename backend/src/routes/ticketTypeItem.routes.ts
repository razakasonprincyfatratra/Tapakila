import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import {
  updateTicketType,
  toggleTicketType,
  deleteTicketType,
} from "../controllers/ticketType.controller.js";

// Monté sur /api/ticket-types dans index.ts
const router = Router();

router.patch("/:id", authMiddleware, requireRole("ORGANIZER", "ADMIN"), updateTicketType);
router.patch("/:id/toggle", authMiddleware, requireRole("ORGANIZER", "ADMIN"), toggleTicketType);
router.delete("/:id", authMiddleware, requireRole("ORGANIZER", "ADMIN"), deleteTicketType);

export default router;