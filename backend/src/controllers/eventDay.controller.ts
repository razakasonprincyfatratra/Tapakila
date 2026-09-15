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

export async function createEventDay(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const eventId = paramToString(req.params.eventId);
    if (!eventId) return res.status(400).json({ error: "Paramètre eventId manquant" });

    const check = await assertEventOwnership(eventId, req);
    if (check.error) return res.status(check.error.status).json({ error: check.error.message });

    const { date, label, startTime, endTime } = req.body;

    if (!date) {
      return res.status(400).json({ error: "Champ requis manquant (date)" });
    }

    const count = await prisma.eventDay.count({ where: { eventId } });

    const eventDay = await prisma.eventDay.create({
      data: {
        eventId,
        date: new Date(date),
        label: label ?? null,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        order: count,
      },
    });

    return res.status(201).json({ eventDay });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ error: "Une journée existe déjà à cette date pour cet événement" });
    }
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function listEventDays(req: AuthRequest, res: Response) {
  try {
    const eventId = paramToString(req.params.eventId);
    if (!eventId) return res.status(400).json({ error: "Paramètre eventId manquant" });

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: "Événement introuvable" });

    const eventDays = await prisma.eventDay.findMany({
      where: { eventId },
      orderBy: { order: "asc" },
    });

    return res.json({ eventDays });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function updateEventDay(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const id = paramToString(req.params.id);
    if (!id) return res.status(400).json({ error: "Paramètre id manquant" });

    const eventDay = await prisma.eventDay.findUnique({ where: { id } });
    if (!eventDay) return res.status(404).json({ error: "Journée introuvable" });

    const check = await assertEventOwnership(eventDay.eventId, req);
    if (check.error) return res.status(check.error.status).json({ error: check.error.message });

    const { date, label, startTime, endTime } = req.body;

    const updated = await prisma.eventDay.update({
      where: { id },
      data: {
        ...(date !== undefined && { date: new Date(date) }),
        ...(label !== undefined && { label }),
        ...(startTime !== undefined && { startTime: startTime ? new Date(startTime) : null }),
        ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
      },
    });

    return res.json({ eventDay: updated });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ error: "Une journée existe déjà à cette date pour cet événement" });
    }
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function deleteEventDay(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const id = paramToString(req.params.id);
    if (!id) return res.status(400).json({ error: "Paramètre id manquant" });

    const eventDay = await prisma.eventDay.findUnique({ where: { id } });
    if (!eventDay) return res.status(404).json({ error: "Journée introuvable" });

    const check = await assertEventOwnership(eventDay.eventId, req);
    if (check.error) return res.status(check.error.status).json({ error: check.error.message });

    // Une journée déjà rattachée à un type de billet (SINGLE_DAY/MULTI_DAY) ne doit pas
    // pouvoir être supprimée silencieusement (le cascade Prisma casserait la cohérence
    // du ticket type sans prévenir l'organisateur). On demande d'abord de la détacher.
    const linkedTicketTypesCount = await prisma.ticketTypeEventDay.count({ where: { eventDayId: id } });
    if (linkedTicketTypesCount > 0) {
      return res.status(400).json({
        error: "Impossible de supprimer une journée liée à un type de billet. Retire-la d'abord des types de billets concernés.",
      });
    }

    const checkInsCount = await prisma.checkIn.count({ where: { eventDayId: id } });
    if (checkInsCount > 0) {
      return res.status(400).json({ error: "Impossible de supprimer une journée ayant déjà des check-ins enregistrés." });
    }

    await prisma.eventDay.delete({ where: { id } });

    return res.json({ message: "Journée supprimée" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function reorderEventDays(req: AuthRequest, res: Response) {
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
        prisma.eventDay.update({
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
