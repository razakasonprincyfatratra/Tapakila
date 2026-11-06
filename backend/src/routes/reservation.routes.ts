import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  createReservation,
  confirmReservation,
  cancelReservation,
  listMyReservations,
  getReservation,
  listReservationTickets,
  checkInReservation,
} from "../controllers/reservation.controller.js";

const router = Router();

router.post("/", authMiddleware, createReservation);
router.get("/mine", authMiddleware, listMyReservations);
router.post("/check-in", authMiddleware, checkInReservation);
router.get("/:id", authMiddleware, getReservation);
router.get("/:id/tickets", authMiddleware, listReservationTickets);
router.patch("/:id/confirm", authMiddleware, confirmReservation);
router.patch("/:id/cancel", authMiddleware, cancelReservation);

export default router;