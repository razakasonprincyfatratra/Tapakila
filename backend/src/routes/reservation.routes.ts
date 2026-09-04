import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  createReservation,
  confirmReservation,
  cancelReservation,
  listMyReservations,
  getReservation,
  checkInReservation,
} from "../controllers/reservation.controller.js";

const router = Router();

router.post("/", authMiddleware, createReservation);
router.get("/mine", authMiddleware, listMyReservations);
router.get("/:id", authMiddleware, getReservation);
router.patch("/:id/confirm", authMiddleware, confirmReservation);
router.patch("/:id/cancel", authMiddleware, cancelReservation);
router.post("/check-in", authMiddleware, checkInReservation);

export default router;