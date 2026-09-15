import { Router } from "express";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.middleware.js";
import {
  createEventDay,
  listEventDays,
  updateEventDay,
  deleteEventDay,
  reorderEventDays,
} from "../controllers/eventDay.controller.js";

// Monté avec { mergeParams: true } sur /api/events/:eventId/days dans index.ts
//
// Tout utilisateur authentifié peut gérer les journées de ses propres
// événements ; la vérification de propriété se fait dans le contrôleur.
const router = Router({ mergeParams: true });

router.get("/", optionalAuthMiddleware, listEventDays);
router.post("/", authMiddleware, createEventDay);
router.patch("/reorder", authMiddleware, reorderEventDays);
router.patch("/:id", authMiddleware, updateEventDay);
router.delete("/:id", authMiddleware, deleteEventDay);

export default router;