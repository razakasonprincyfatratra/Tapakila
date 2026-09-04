import { Router } from "express";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import {
  createTicketType,
  listTicketTypes,
  reorderTicketTypes,
} from "../controllers/ticketType.controller.js";

// Monté avec { mergeParams: true } sur /api/events/:eventId/ticket-types dans index.ts
const router = Router({ mergeParams: true });

router.get("/", optionalAuthMiddleware, listTicketTypes);
router.post("/", authMiddleware, requireRole("ORGANIZER", "ADMIN"), createTicketType);
router.patch("/reorder", authMiddleware, requireRole("ORGANIZER", "ADMIN"), reorderTicketTypes);

export default router;