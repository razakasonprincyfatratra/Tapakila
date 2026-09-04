import { Router } from "express";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import {
  createEvent,
  updateEvent,
  deleteEvent,
  publishEvent,
  listEvents,
  getEvent,
  listMyEvents,
  getRegionStats,
} from "../controllers/event.controller.js";

const router = Router();

// IMPORTANT : les routes statiques ("/mine", "/stats/regions") doivent être
// déclarées avant "/:id" pour ne pas être interprétées comme un id d'événement.
router.get("/", listEvents);
router.get("/mine", authMiddleware, requireRole("ORGANIZER", "ADMIN"), listMyEvents);
router.get("/stats/regions", getRegionStats);
router.get("/:id", optionalAuthMiddleware, getEvent);
router.post("/", authMiddleware, requireRole("ORGANIZER", "ADMIN"), createEvent);
router.patch("/:id", authMiddleware, requireRole("ORGANIZER", "ADMIN"), updateEvent);
router.delete("/:id", authMiddleware, requireRole("ORGANIZER", "ADMIN"), deleteEvent);
router.patch("/:id/publish", authMiddleware, requireRole("ORGANIZER", "ADMIN"), publishEvent);

export default router;