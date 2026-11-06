import type { Response } from "express";
import type { ScanResult } from "@prisma/client";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { generateTicketsForReservation } from "../lib/ticketGenerator.js";

function paramToString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function queryToString(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
}

// Une grosse commande (ex: 1 000 billets) est générée par lots de 100 dans une seule
// transaction : on laisse plus de temps que les 5 s par défaut de Prisma.
const CONFIRM_TX_OPTIONS = { maxWait: 10_000, timeout: 60_000 };

export async function createReservation(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const { ticketTypeId, quantity } = req.body;

    if (!ticketTypeId || !quantity || Number(quantity) < 1) {
      return res.status(400).json({ error: "ticketTypeId et quantity (>= 1) sont requis" });
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty)) {
      return res.status(400).json({ error: "quantity doit être un entier" });
    }

    const reservation = await prisma.$transaction(async (tx) => {
      const ticketType = await tx.ticketType.findUnique({
        where: { id: ticketTypeId },
        include: { event: true },
      });

      if (!ticketType) {
        throw new Error("NOT_FOUND");
      }
      if (!ticketType.isActive || ticketType.event.status !== "PUBLISHED") {
        throw new Error("UNAVAILABLE");
      }
      const now = new Date();
      if (ticketType.salesStart && now < ticketType.salesStart) {
        throw new Error("NOT_YET_ON_SALE");
      }
      if (ticketType.salesEnd && now > ticketType.salesEnd) {
        throw new Error("SALES_CLOSED");
      }
      if (ticketType.availableSeats < qty) {
        throw new Error("NOT_ENOUGH_SEATS");
      }

      await tx.ticketType.update({
        where: { id: ticketTypeId },
        data: { availableSeats: { decrement: qty } },
      });

      const totalAmount = Number(ticketType.price) * qty;

      return tx.reservation.create({
        data: {
          userId: req.userId!,
          eventId: ticketType.eventId,
          ticketTypeId,
          quantity: qty,
          totalAmount,
          status: "PENDING",
        },
      });
    });

    return res.status(201).json({
      reservation,
      note:
        "Paiement Efaina pas encore intégré. Utilise PATCH /api/reservations/:id/confirm (temporaire) pour simuler la confirmation.",
    });
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, [number, string]> = {
        NOT_FOUND: [404, "Type de billet introuvable"],
        UNAVAILABLE: [400, "Cet événement ou ce type de billet n'est pas disponible à la réservation"],
        NOT_YET_ON_SALE: [400, "La vente de ce billet n'a pas encore commencé"],
        SALES_CLOSED: [400, "La vente de ce billet est terminée"],
        NOT_ENOUGH_SEATS: [409, "Plus assez de places disponibles pour ce type de billet"],
      };
      const match = messages[error.message];
      if (match) {
        const [status, message] = match;
        return res.status(status).json({ error: message });
      }
    }
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur lors de la réservation" });
  }
}

/**
 * TEMPORAIRE : en attendant l'intégration réelle d'Efaina, ce endpoint permet
 * de simuler la confirmation d'un paiement (accessible au propriétaire de la
 * réservation). À terme, il sera remplacé/complété par un webhook Efaina vérifié
 * côté serveur : la logique ci-dessous (passage PENDING -> CONFIRMED puis génération
 * des billets) pourra être réutilisée telle quelle par ce webhook.
 *
 * Règle métier : une réservation de N billets génère exactement N billets individuels,
 * chacun avec son QR code unique et son code de secours. La génération n'a lieu qu'une
 * seule fois (un appel répété ne crée aucun doublon).
 */
export async function confirmReservation(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const id = paramToString(req.params.id);
    if (!id) return res.status(400).json({ error: "Paramètre id manquant" });

    const reservation = await prisma.reservation.findUnique({ where: { id } });
    if (!reservation) return res.status(404).json({ error: "Réservation introuvable" });

    if (reservation.userId !== req.userId && req.userRole !== "ADMIN") {
      return res.status(403).json({ error: "Tu n'es pas autorisé à confirmer cette réservation" });
    }

    if (reservation.status === "CANCELLED") {
      return res.status(400).json({ error: "Cette réservation a été annulée" });
    }

    const { paymentRef } = req.body ?? {};

    const updated = await prisma.$transaction(async (tx) => {
      // Passage PENDING -> CONFIRMED atomique : si deux requêtes arrivent en même temps
      // (ou si le prestataire de paiement renvoie la notification), une seule "gagne"
      // et génère les billets.
      const claimed = await tx.reservation.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "CONFIRMED",
          paymentRef: paymentRef ?? `SIMULATED-${Date.now()}`,
        },
      });

      if (claimed.count === 1) {
        await generateTicketsForReservation(tx, {
          reservationId: id,
          eventId: reservation.eventId,
          quantity: reservation.quantity,
        });
      }

      return tx.reservation.findUnique({
        where: { id },
        include: { _count: { select: { tickets: true } } },
      });
    }, CONFIRM_TX_OPTIONS);

    return res.json({ reservation: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur lors de la confirmation" });
  }
}

export async function cancelReservation(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const id = paramToString(req.params.id);
    if (!id) return res.status(400).json({ error: "Paramètre id manquant" });

    const reservation = await prisma.reservation.findUnique({ where: { id } });
    if (!reservation) return res.status(404).json({ error: "Réservation introuvable" });

    if (reservation.userId !== req.userId && req.userRole !== "ADMIN") {
      return res.status(403).json({ error: "Tu n'es pas autorisé à annuler cette réservation" });
    }

    if (reservation.status === "CANCELLED") {
      return res.status(400).json({ error: "Cette réservation est déjà annulée" });
    }

    if (reservation.checkedInAt) {
      return res.status(400).json({ error: "Impossible d'annuler un billet déjà utilisé" });
    }

    await prisma.$transaction(async (tx) => {
      // Un billet déjà scanné (mono-jour) ou déjà badgé un jour (multi-jours) bloque l'annulation.
      const alreadyChecked = await tx.checkIn.count({ where: { reservationId: id } });
      if (alreadyChecked > 0) throw new Error("ALREADY_USED");

      await tx.reservation.update({ where: { id }, data: { status: "CANCELLED" } });

      // Invalide tous les billets encore utilisables. Si un billet a été scanné
      // entre-temps, le décompte ne correspond plus et on annule toute l'opération.
      const invalidated = await tx.ticket.updateMany({
        where: { reservationId: id, status: { in: ["VALID", "PENDING"] } },
        data: { status: "CANCELLED" },
      });
      const totalTickets = await tx.ticket.count({ where: { reservationId: id } });
      if (invalidated.count !== totalTickets) throw new Error("ALREADY_USED");

      await tx.ticketType.update({
        where: { id: reservation.ticketTypeId },
        data: { availableSeats: { increment: reservation.quantity } },
      });
    });

    return res.json({ message: "Réservation annulée" });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_USED") {
      return res.status(400).json({ error: "Impossible d'annuler : au moins un billet a déjà été utilisé" });
    }
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur lors de l'annulation" });
  }
}

export async function listMyReservations(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const reservations = await prisma.reservation.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      include: {
        event: {
          select: { id: true, title: true, startDate: true, location: true, coverImageUrl: true },
        },
        ticketType: { select: { id: true, name: true, price: true } },
        _count: { select: { tickets: true } },
      },
    });

    return res.json({ reservations });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getReservation(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const id = paramToString(req.params.id);
    if (!id) return res.status(400).json({ error: "Paramètre id manquant" });

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        event: { select: { id: true, title: true, startDate: true, location: true, organizerId: true } },
        ticketType: { select: { id: true, name: true, price: true } },
        _count: { select: { tickets: true } },
      },
    });

    if (!reservation) return res.status(404).json({ error: "Réservation introuvable" });

    const isOwner = reservation.userId === req.userId;
    const isOrganizer = reservation.event.organizerId === req.userId;
    const isAdmin = req.userRole === "ADMIN";

    if (!isOwner && !isOrganizer && !isAdmin) {
      return res.status(403).json({ error: "Accès refusé" });
    }

    return res.json({ reservation });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

/**
 * Liste paginée des billets individuels (un QR code chacun) d'une réservation.
 * Paginée car une commande peut compter des centaines de billets.
 * GET /api/reservations/:id/tickets?page=1&limit=50
 */
export async function listReservationTickets(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const id = paramToString(req.params.id);
    if (!id) return res.status(400).json({ error: "Paramètre id manquant" });

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { event: { select: { organizerId: true } } },
    });
    if (!reservation) return res.status(404).json({ error: "Réservation introuvable" });

    const isOwner = reservation.userId === req.userId;
    const isOrganizer = reservation.event.organizerId === req.userId;
    const isAdmin = req.userRole === "ADMIN";
    if (!isOwner && !isOrganizer && !isAdmin) {
      return res.status(403).json({ error: "Accès refusé" });
    }

    const page = Math.max(1, Number(queryToString(req.query.page)) || 1);
    const limit = Math.min(100, Math.max(1, Number(queryToString(req.query.limit)) || 50));

    const [tickets, total, usedCount] = await Promise.all([
      prisma.ticket.findMany({
        where: { reservationId: id },
        orderBy: { number: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          number: true,
          qrCode: true,
          backupCode: true,
          status: true,
          usedAt: true,
        },
      }),
      prisma.ticket.count({ where: { reservationId: id } }),
      prisma.ticket.count({ where: { reservationId: id, status: "USED" } }),
    ]);

    return res.json({ tickets, total, usedCount, page, limit });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function listEventReservations(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const eventId = paramToString(req.params.eventId);
    if (!eventId) return res.status(400).json({ error: "Paramètre eventId manquant" });

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: "Événement introuvable" });

    if (event.organizerId !== req.userId && req.userRole !== "ADMIN") {
      return res.status(403).json({ error: "Accès refusé" });
    }

    const reservations = await prisma.reservation.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        ticketType: { select: { id: true, name: true } },
        _count: { select: { tickets: true } },
      },
    });

    return res.json({ reservations });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

// ---------------------------------------------------------------------------
// Check-in (scan d'un billet individuel)
// ---------------------------------------------------------------------------

async function logScan(data: {
  ticketId: string | null;
  eventId: string | null;
  agentId: string;
  code: string;
  result: ScanResult;
  scannedAt: Date;
}) {
  try {
    await prisma.scan.create({
      data: { ...data, code: data.code.slice(0, 64) },
    });
  } catch (error) {
    // Le journal ne doit jamais bloquer un contrôle d'entrée.
    console.error("Échec de journalisation du scan", error);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

/**
 * Check-in d'un billet, via QR (token unique) ou code de secours.
 * Chaque billet a son propre QR : scanner un billet n'affecte jamais les autres
 * billets de la même réservation.
 *
 * Règles :
 * - Le serveur est seul juge de la validité du billet.
 * - Validation atomique : `updateMany ... where status = VALID` garantit que deux agents
 *   scannant le même billet au même instant ne peuvent pas tous les deux l'accepter.
 * - Chaque scan (valide ou refusé) est journalisé dans la table Scan.
 * - `scannedAt` (optionnel) permet de resynchroniser un scan fait hors-ligne avec son heure réelle.
 *   NB : le mode hors-ligne ne garantit pas l'unicité d'usage d'un billet sur plusieurs téléphones.
 *
 * Réponse : toujours un champ `result` (VALID | ALREADY_USED | INVALID | CANCELLED | REFUNDED
 * | EXPIRED | WRONG_EVENT_DAY) pour que l'écran de l'agent affiche VALIDE / DÉJÀ UTILISÉ /
 * INVALIDE / EXPIRÉ sans interpréter les messages.
 *
 * Événements multi-jours (event.eventDays non vide) : `eventDayId` précise la journée scannée.
 * Le check-in est enregistré par billet et par journée (table CheckIn). Un billet SINGLE_DAY
 * passe en USED après son unique journée ; MULTI_DAY / FULL_PASS restent VALID et sont badgés
 * jour par jour.
 */
export async function checkInReservation(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    if (req.userRole !== "ORGANIZER" && req.userRole !== "ADMIN") {
      return res.status(403).json({ error: "Tu n'es pas autorisé à contrôler les entrées" });
    }

    const { code, scannedAt, eventDayId } = req.body ?? {};

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Code (QR ou code de secours) manquant" });
    }

    const scanDate = scannedAt ? new Date(scannedAt) : new Date();
    if (Number.isNaN(scanDate.getTime())) {
      return res.status(400).json({ error: "scannedAt invalide" });
    }
    const isLiveScan = !scannedAt;

    const cleanCode = code.trim();
    const agentId = req.userId;

    const ticket = await prisma.ticket.findFirst({
      where: { OR: [{ qrCode: cleanCode }, { backupCode: cleanCode.toUpperCase() }] },
      include: {
        event: { include: { eventDays: true } },
        reservation: { include: { ticketType: { include: { eventDays: true } } } },
      },
    });

    if (!ticket) {
      await logScan({
        ticketId: null,
        eventId: null,
        agentId,
        code: cleanCode,
        result: "INVALID",
        scannedAt: scanDate,
      });
      return res.status(404).json({ result: "INVALID", error: "Code invalide" });
    }

    if (ticket.event.organizerId !== agentId && req.userRole !== "ADMIN") {
      return res.status(403).json({ error: "Tu n'es pas autorisé à valider les entrées de cet événement" });
    }

    // Réponse de refus + journalisation
    const refuse = async (
      result: Exclude<ScanResult, "VALID">,
      httpStatus: number,
      message: string,
      extra: Record<string, unknown> = {}
    ) => {
      await logScan({
        ticketId: ticket.id,
        eventId: ticket.eventId,
        agentId,
        code: cleanCode,
        result,
        scannedAt: scanDate,
      });
      return res.status(httpStatus).json({
        result,
        alreadyUsed: result === "ALREADY_USED",
        message,
        ticket: { id: ticket.id, number: ticket.number },
        ...extra,
      });
    };

    // ---------- Statut du billet ----------
    if (ticket.status === "USED") {
      return refuse(
        "ALREADY_USED",
        409,
        `Billet déjà utilisé${ticket.usedAt ? ` le ${ticket.usedAt.toLocaleString("fr-FR")}` : ""}`,
        { firstScanAt: ticket.usedAt }
      );
    }
    if (ticket.status === "CANCELLED") {
      return refuse("CANCELLED", 409, "Ce billet a été annulé");
    }
    if (ticket.status === "REFUNDED") {
      return refuse("REFUNDED", 409, "Ce billet a été remboursé");
    }
    if (ticket.status === "EXPIRED") {
      return refuse("EXPIRED", 409, "Ce billet a expiré");
    }
    if (ticket.status === "PENDING" || ticket.reservation.status !== "CONFIRMED") {
      return refuse("INVALID", 400, "Ce billet n'est pas confirmé (paiement non finalisé)");
    }

    // ---------- Statut de l'événement ----------
    if (ticket.event.status === "CANCELLED") {
      return refuse("CANCELLED", 409, "Cet événement a été annulé");
    }
    const endDate = ticket.event.endDate;
    const eventIsOver =
      (endDate !== null && scanDate > endDate) || (isLiveScan && ticket.event.status === "COMPLETED");
    if (eventIsOver) {
      return refuse("EXPIRED", 409, "Cet événement est terminé");
    }

    const scannedCount = async (dayId: string | null) =>
      dayId
        ? prisma.checkIn.count({ where: { eventDayId: dayId } })
        : prisma.ticket.count({ where: { eventId: ticket.eventId, status: "USED" } });

    const eventHasDays = ticket.event.eventDays.length > 0;

    // ---------- Événement simple (mono-jour) ----------
    if (!eventHasDays) {
      // Validation atomique : un seul scan peut faire passer VALID -> USED.
      const claimed = await prisma.ticket.updateMany({
        where: { id: ticket.id, status: "VALID" },
        data: { status: "USED", usedAt: scanDate, usedById: agentId },
      });

      if (claimed.count === 0) {
        // Un autre agent a scanné ce billet à l'instant (ou le billet vient d'être annulé).
        const fresh = await prisma.ticket.findUnique({ where: { id: ticket.id } });
        if (fresh?.status === "USED") {
          return refuse(
            "ALREADY_USED",
            409,
            `Billet déjà utilisé${fresh.usedAt ? ` le ${fresh.usedAt.toLocaleString("fr-FR")}` : ""}`,
            { firstScanAt: fresh.usedAt }
          );
        }
        return refuse("CANCELLED", 409, "Ce billet n'est plus valide");
      }

      await logScan({
        ticketId: ticket.id,
        eventId: ticket.eventId,
        agentId,
        code: cleanCode,
        result: "VALID",
        scannedAt: scanDate,
      });

      return res.json({
        result: "VALID",
        alreadyUsed: false,
        ticket: { id: ticket.id, number: ticket.number, status: "USED", usedAt: scanDate },
        event: { id: ticket.event.id, title: ticket.event.title },
        scannedCount: await scannedCount(null),
      });
    }

    // ---------- Événement multi-jours : check-in par billet et par journée ----------
    const accessType = ticket.reservation.ticketType.accessType;
    const linkedDayIds = ticket.reservation.ticketType.eventDays.map((link) => link.eventDayId);

    let targetDayId: string;

    if (accessType === "SINGLE_DAY") {
      if (linkedDayIds.length !== 1) {
        return res.status(500).json({ error: "Configuration du billet invalide (journée manquante)" });
      }
      const onlyDayId = linkedDayIds[0]!;
      if (eventDayId && eventDayId !== onlyDayId) {
        return refuse("WRONG_EVENT_DAY", 400, "Ce billet n'est pas valable pour cette journée");
      }
      targetDayId = onlyDayId;
    } else {
      // MULTI_DAY ou FULL_PASS : la journée scannée doit être précisée explicitement
      if (!eventDayId || typeof eventDayId !== "string") {
        return res.status(400).json({ error: "eventDayId est requis pour ce type de billet" });
      }

      const belongsToEvent = ticket.event.eventDays.some((day) => day.id === eventDayId);
      if (!belongsToEvent) {
        return res.status(400).json({ error: "Cette journée n'appartient pas à cet événement" });
      }

      if (accessType === "MULTI_DAY" && !linkedDayIds.includes(eventDayId)) {
        return refuse("WRONG_EVENT_DAY", 400, "Ce billet n'est pas valable pour cette journée");
      }

      // FULL_PASS : valable pour n'importe quelle journée de l'événement
      targetDayId = eventDayId;
    }

    try {
      await prisma.$transaction(async (tx) => {
        // La contrainte unique [ticketId, eventDayId] garantit un seul badgeage par jour,
        // même avec deux scans simultanés.
        await tx.checkIn.create({
          data: {
            reservationId: ticket.reservationId,
            ticketId: ticket.id,
            eventDayId: targetDayId,
            checkedInAt: scanDate,
            checkedInById: agentId,
          },
        });

        if (accessType === "SINGLE_DAY") {
          await tx.ticket.update({
            where: { id: ticket.id },
            data: { status: "USED", usedAt: scanDate, usedById: agentId },
          });
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existing = await prisma.checkIn.findUnique({
          where: { ticketId_eventDayId: { ticketId: ticket.id, eventDayId: targetDayId } },
        });
        return refuse(
          "ALREADY_USED",
          409,
          `Billet déjà utilisé pour cette journée${
            existing ? ` le ${existing.checkedInAt.toLocaleString("fr-FR")}` : ""
          }`,
          { eventDayId: targetDayId, firstScanAt: existing?.checkedInAt ?? null }
        );
      }
      throw error;
    }

    await logScan({
      ticketId: ticket.id,
      eventId: ticket.eventId,
      agentId,
      code: cleanCode,
      result: "VALID",
      scannedAt: scanDate,
    });

    return res.json({
      result: "VALID",
      alreadyUsed: false,
      ticket: { id: ticket.id, number: ticket.number },
      event: { id: ticket.event.id, title: ticket.event.title },
      eventDayId: targetDayId,
      scannedCount: await scannedCount(targetDayId),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur lors du check-in" });
  }
}