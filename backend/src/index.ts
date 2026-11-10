import express from "express";
import cors from "cors";
import "dotenv/config";
import { prisma } from "./lib/prisma.js";
import authRoutes from "./routes/auth.routes.js";
import eventRoutes from "./routes/event.routes.js";
import eventDayRoutes from "./routes/eventDay.routes.js";
import ticketTypeRoutes from "./routes/ticketType.routes.js";
import ticketTypeItemRoutes from "./routes/ticketTypeItem.routes.js";
import reservationRoutes from "./routes/reservation.routes.js";
import eventReservationRoutes from "./routes/eventReservation.routes.js";
import userRoutes from "./routes/user.routes.js";
import eventCommentRoutes from "./routes/eventComment.routes.js";
import eventReactionRoutes from "./routes/eventReaction.routes.js";
import commentRoutes from "./routes/comment.routes.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    res.status(500).json({ status: "error", database: "disconnected" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/events/:eventId/days", eventDayRoutes);
app.use("/api/events/:eventId/ticket-types", ticketTypeRoutes);
app.use("/api/events/:eventId/comments", eventCommentRoutes);
app.use("/api/events/:eventId/reactions", eventReactionRoutes);
app.use("/api/ticket-types", ticketTypeItemRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/events/:eventId/reservations", eventReservationRoutes);
app.use("/api/comments", commentRoutes);

app.listen(PORT, () => {
  console.log(`Serveur backend démarré sur http://localhost:${PORT}`);
});