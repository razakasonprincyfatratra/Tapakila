import express from "express";
import cors from "cors";
import "dotenv/config";
import { prisma } from "./lib/prisma.js";
import authRoutes from "./routes/auth.routes.js";
import organizerRoutes from "./routes/organizer.routes.js";
import eventRoutes from "./routes/event.routes.js";
import ticketTypeRoutes from "./routes/ticketType.routes.js";
import ticketTypeItemRoutes from "./routes/ticketTypeItem.routes.js";
import reservationRoutes from "./routes/reservation.routes.js";
import eventReservationRoutes from "./routes/eventReservation.routes.js";

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
app.use("/api/organizer", organizerRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/events/:eventId/ticket-types", ticketTypeRoutes);
app.use("/api/ticket-types", ticketTypeItemRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/events/:eventId/reservations", eventReservationRoutes);

app.listen(PORT, () => {
  console.log(`Serveur backend démarré sur http://localhost:${PORT}`);
});