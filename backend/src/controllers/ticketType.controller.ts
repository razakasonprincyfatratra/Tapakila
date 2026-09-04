import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";

/**
 * Express type parfois req.params comme Record<string, string | string[]>
 * (notamment avec des routeurs imbriqués via mergeParams). Cette fonction
 * ramène systématiquement la valeur à un simple string (ou undefined).
 */
function paramToString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function assertEventOwnership(eventId: string, req: AuthRequest) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return { error: { status: 404, message: "Événement introuvable" } } as const;
  }
  if (event.organizerId !== req.userId && req.userRole !== "ADMIN") {
    return { error: { status: 403, message: "Tu n'es pas autorisé à gérer cet événement" } } as const;
  }
  return { event } as const;
}

export async function createTicketType(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const eventId = paramToString(req.params.eventId);
    if (!eventId) return res.status(400).json({ error: "Paramètre eventId manquant" });

    const check = await assertEventOwnership(eventId, req);
    if (check.error) return res.status(check.error.status).json({ error: check.error.message });

    const { name, description, price, totalSeats, seatMapZone, salesStart, salesEnd } = req.body;

    if (!name || price === undefined || totalSeats === undefined) {
      return res.status(400).json({ error: "Champs requis manquants (name, price, totalSeats)" });
    }

    const count = await prisma.ticketType.count({ where: { eventId } });

    const ticketType = await prisma.ticketType.create({
      data: {
        eventId,
        name,
        description: description ?? null,
        price,
        totalSeats: Number(totalSeats),
        availableSeats: Number(totalSeats),
        seatMapZone: seatMapZone ?? null,
        salesStart: salesStart ? new Date(salesStart) : null,
        salesEnd: salesEnd ? new Date(salesEnd) : null,
        order: count,
      },
    });

    return res.status(201).json({ ticketType });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function listTicketTypes(req: AuthRequest, res: Response) {
  try {
    const eventId = paramToString(req.params.eventId);
    if (!eventId) return res.status(400).json({ error: "Paramètre eventId manquant" });

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: "Événement introuvable" });

    const isOwner = req.userId === event.organizerId;
    const isAdmin = req.userRole === "ADMIN";

    const ticketTypes = await prisma.ticketType.findMany({
      where: { eventId, ...(isOwner || isAdmin ? {} : { isActive: true }) },
      orderBy: { order: "asc" },
    });

    return res.json({ ticketTypes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function updateTicketType(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const id = paramToString(req.params.id);
    if (!id) return res.status(400).json({ error: "Paramètre id manquant" });

    const ticketType = await prisma.ticketType.findUnique({ where: { id } });
    if (!ticketType) return res.status(404).json({ error: "Type de billet introuvable" });

    const check = await assertEventOwnership(ticketType.eventId, req);
    if (check.error) return res.status(check.error.status).json({ error: check.error.message });

    const { name, description, price, totalSeats, seatMapZone, salesStart, salesEnd } = req.body;

    const updated = await prisma.ticketType.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(totalSeats !== undefined && { totalSeats: Number(totalSeats) }),
        ...(seatMapZone !== undefined && { seatMapZone }),
        ...(salesStart !== undefined && { salesStart: salesStart ? new Date(salesStart) : null }),
        ...(salesEnd !== undefined && { salesEnd: salesEnd ? new Date(salesEnd) : null }),
      },
    });

    return res.json({ ticketType: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function toggleTicketType(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const id = paramToString(req.params.id);
    if (!id) return res.status(400).json({ error: "Paramètre id manquant" });

    const ticketType = await prisma.ticketType.findUnique({ where: { id } });
    if (!ticketType) return res.status(404).json({ error: "Type de billet introuvable" });

    const check = await assertEventOwnership(ticketType.eventId, req);
    if (check.error) return res.status(check.error.status).json({ error: check.error.message });

    const updated = await prisma.ticketType.update({
      where: { id },
      data: { isActive: !ticketType.isActive },
    });

    return res.json({ ticketType: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function deleteTicketType(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const id = paramToString(req.params.id);
    if (!id) return res.status(400).json({ error: "Paramètre id manquant" });

    const ticketType = await prisma.ticketType.findUnique({ where: { id } });
    if (!ticketType) return res.status(404).json({ error: "Type de billet introuvable" });

    const check = await assertEventOwnership(ticketType.eventId, req);
    if (check.error) return res.status(check.error.status).json({ error: check.error.message });

    const salesCount = await prisma.reservation.count({ where: { ticketTypeId: id } });
    if (salesCount > 0) {
      return res
        .status(400)
        .json({ error: "Impossible de supprimer un billet déjà vendu. Désactive-le plutôt." });
    }

    await prisma.ticketType.delete({ where: { id } });

    return res.json({ message: "Type de billet supprimé" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function reorderTicketTypes(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const eventId = paramToString(req.params.eventId);
    if (!eventId) return res.status(400).json({ error: "Paramètre eventId manquant" });

    const check = await assertEventOwnership(eventId, req);
    if (check.error) return res.status(check.error.status).json({ error: check.error.message });

    const { order } = req.body as { order: { id: string; position: number }[] };

    if (!Array.isArray(order)) {
      return res.status(400).json({ error: "Format invalide, 'order' doit être un tableau" });
    }

    await prisma.$transaction(
      order.map((item) =>
        prisma.ticketType.update({
          where: { id: item.id },
          data: { order: item.position },
        })
      )
    );

    return res.json({ message: "Ordre mis à jour" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}