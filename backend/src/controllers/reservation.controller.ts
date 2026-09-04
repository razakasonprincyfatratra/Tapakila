import type { Response } from "express";
import crypto from "node:crypto";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";

function paramToString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

// Code de secours court, lisible, à afficher sous le QR (ex: pour les zones sans réseau).
function generateBackupCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans caractères ambigus (0/O, 1/I...)
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return code;
}

export async function createReservation(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const { ticketTypeId, quantity } = req.body;

    if (!ticketTypeId || !quantity || Number(quantity) < 1) {
      return res.status(400).json({ error: "ticketTypeId et quantity (>= 1) sont requis" });
    }

    const qty = Number(quantity);

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
        "Paiement Efaina pas encore intégré. Utilise POST /api/reservations/:id/confirm (temporaire) pour simuler la confirmation.",
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
 * réservation). À terme, il sera remplacé/complété par un webhook Efaina qui
 * confirmera automatiquement le paiement côté serveur.
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

    if (reservation.status === "CONFIRMED") {
      return res.json({ reservation });
    }

    const { paymentRef } = req.body ?? {};

    let qrCode = crypto.randomUUID();
    let backupCode = generateBackupCode();

    // Sécurité en cas de collision improbable sur le code de secours
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await prisma.reservation.findUnique({ where: { backupCode } });
      if (!clash) break;
      backupCode = generateBackupCode();
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        qrCode,
        backupCode,
        paymentRef: paymentRef ?? `SIMULATED-${Date.now()}`,
      },
    });

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

    await prisma.$transaction([
      prisma.reservation.update({ where: { id }, data: { status: "CANCELLED" } }),
      prisma.ticketType.update({
        where: { id: reservation.ticketTypeId },
        data: { availableSeats: { increment: reservation.quantity } },
      }),
    ]);

    return res.json({ message: "Réservation annulée" });
  } catch (error) {
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
      },
    });

    return res.json({ reservations });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

/**
 * Check-in d'un billet, via QR (identifiant unique) ou code de secours.
 * Conçu pour un scan hors-ligne avec synchronisation différée :
 * - `scannedAt` (optionnel) permet au client de renvoyer l'heure réelle du scan,
 *   même si la requête n'arrive au serveur qu'après reconnexion.
 * - Rejouer le même scan (ex: retry réseau) ne casse rien : la réponse indique
 *   simplement `alreadyUsed: true` avec l'horodatage d'origine, sans erreur bloquante.
 */
export async function checkInReservation(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const { code, scannedAt } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Code (QR ou code de secours) manquant" });
    }

    const reservation = await prisma.reservation.findFirst({
      where: { OR: [{ qrCode: code }, { backupCode: code }] },
      include: { event: true },
    });

    if (!reservation) {
      return res.status(404).json({ error: "Code invalide" });
    }

    if (reservation.event.organizerId !== req.userId && req.userRole !== "ADMIN") {
      return res.status(403).json({ error: "Tu n'es pas autorisé à valider les entrées de cet événement" });
    }

    if (reservation.status !== "CONFIRMED") {
      return res.status(400).json({ error: "Ce billet n'est pas confirmé (paiement non finalisé)" });
    }

    if (reservation.checkedInAt) {
      return res.status(200).json({
        alreadyUsed: true,
        checkedInAt: reservation.checkedInAt,
        message: `Billet déjà utilisé le ${reservation.checkedInAt.toLocaleString("fr-FR")}`,
      });
    }

    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        checkedInAt: scannedAt ? new Date(scannedAt) : new Date(),
        checkedInById: req.userId,
      },
    });

    return res.json({ alreadyUsed: false, reservation: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur lors du check-in" });
  }
}