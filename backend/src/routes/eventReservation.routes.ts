import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { listEventReservations } from "../controllers/reservation.controller.js";

// Monté avec { mergeParams: true } sur /api/events/:eventId/reservations dans index.ts
const router = Router({ mergeParams: true });

router.get("/", authMiddleware, listEventReservations);

export default router;