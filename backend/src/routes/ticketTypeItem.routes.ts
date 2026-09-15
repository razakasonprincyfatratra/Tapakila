import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  updateTicketType,
  toggleTicketType,
  deleteTicketType,
} from "../controllers/ticketType.controller.js";

// Monté sur /api/ticket-types dans index.ts
//
// Tout utilisateur authentifié peut modifier/désactiver/supprimer les types
// de billets de ses propres événements ; la vérification de propriété se
// fait dans le contrôleur.
const router = Router();

router.patch("/:id", authMiddleware, updateTicketType);
router.patch("/:id/toggle", authMiddleware, toggleTicketType);
router.delete("/:id", authMiddleware, deleteTicketType);

export default router;