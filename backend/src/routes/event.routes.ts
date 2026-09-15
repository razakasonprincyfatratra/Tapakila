import { Router } from "express";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.middleware.js";
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
//
// Tout utilisateur authentifié peut créer et gérer ses propres événements
// (plus de rôle ORGANIZER à obtenir au préalable). La vérification de
// propriété (organizerId === req.userId, ou ADMIN) reste faite dans le
// contrôleur pour update/delete/publish.
router.get("/", listEvents);
router.get("/mine", authMiddleware, listMyEvents);
router.get("/stats/regions", getRegionStats);
router.get("/:id", optionalAuthMiddleware, getEvent);
router.post("/", authMiddleware, createEvent);
router.patch("/:id", authMiddleware, updateEvent);
router.delete("/:id", authMiddleware, deleteEvent);
router.patch("/:id/publish", authMiddleware, publishEvent);

export default router;