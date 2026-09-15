import { Router } from "express";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.middleware.js";
import {
  createTicketType,
  listTicketTypes,
  reorderTicketTypes,
} from "../controllers/ticketType.controller.js";

// Monté avec { mergeParams: true } sur /api/events/:eventId/ticket-types dans index.ts
//
// Tout utilisateur authentifié peut créer des types de billets sur ses propres
// événements ; la vérification de propriété se fait dans le contrôleur.
const router = Router({ mergeParams: true });

router.get("/", optionalAuthMiddleware, listTicketTypes);
router.post("/", authMiddleware, createTicketType);
router.patch("/reorder", authMiddleware, reorderTicketTypes);

export default router;