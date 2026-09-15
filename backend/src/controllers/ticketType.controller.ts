import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { TicketAccessType } from "@prisma/client";

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

function isValidAccessType(value: unknown): value is TicketAccessType {
  return typeof value === "string" && (Object.values(TicketAccessType) as string[]).includes(value);
}

/**
 * Valide et normalise la liste des EventDay associés à un TicketType, en
 * fonction de son accessType :
 * - FULL_PASS  -> aucune ligne TicketTypeEventDay (accès implicite à tous les jours,
 *                 y compris ceux ajoutés après coup). eventDayIds est ignoré.
 * - SINGLE_DAY -> exactement un eventDayId, appartenant bien à l'événement.
 * - MULTI_DAY  -> un ou plusieurs eventDayIds, sans doublon, appartenant tous à l'événement.
 */
async function resolveEventDayLinks(
  eventId: string,
  accessType: TicketAccessType,
  eventDayIds: unknown
): Promise<{ error: string } | { eventDayIds: string[] }> {
  if (accessType === TicketAccessType.FULL_PASS) {
    return { eventDayIds: [] };
  }

  if (!Array.isArray(eventDayIds) || eventDayIds.length === 0) {
    return { error: "eventDayIds est requis (et non vide) pour accessType SINGLE_DAY ou MULTI_DAY" };
  }

  const ids = eventDayIds.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (ids.length !== eventDayIds.length) {
    return { error: "eventDayIds doit être un tableau de chaînes non vides" };
  }

  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length !== ids.length) {
    return { error: "eventDayIds contient des doublons" };
  }

  if (accessType === TicketAccessType.SINGLE_DAY && uniqueIds.length !== 1) {
    return { error: "accessType SINGLE_DAY nécessite exactement un eventDayId" };
  }

  const matchingDays = await prisma.eventDay.findMany({
    where: { id: { in: uniqueIds }, eventId },
    select: { id: true },
  });

  if (matchingDays.length !== uniqueIds.length) {
    return { error: "Un ou plusieurs eventDayIds sont invalides pour cet événement" };
  }

  return { eventDayIds: uniqueIds };
}

const ticketTypeWithDaysInclude = {
  eventDays: { include: { eventDay: true } },
} as const;

export async function createTicketType(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const eventId = paramToString(req.params.eventId);
    if (!eventId) return res.status(400).json({ error: "Paramètre eventId manquant" });

    const check = await assertEventOwnership(eventId, req);
    if (check.error) return res.status(check.error.status).json({ error: check.error.message });

    const {
      name,
      description,
      price,
      totalSeats,
      seatMapZone,
      salesStart,
      salesEnd,
      accessType,
      eventDayIds,
    } = req.body;

    if (!name || price === undefined || totalSeats === undefined) {
      return res.status(400).json({ error: "Champs requis manquants (name, price, totalSeats)" });
    }

    const accessTypeProvided = accessType !== undefined;
    const eventDayIdsProvided = eventDayIds !== undefined;

    if (accessTypeProvided && !isValidAccessType(accessType)) {
      return res
        .status(400)
        .json({ error: "accessType invalide (SINGLE_DAY, MULTI_DAY ou FULL_PASS)" });
    }

    let resolvedAccessType: TicketAccessType = TicketAccessType.SINGLE_DAY;
    let daysResult: { eventDayIds: string[] } = { eventDayIds: [] };

    // La logique multi-jours ne se déclenche que si l'appelant en parle explicitement.
    // Un événement simple (mono-jour, sans EventDay défini) continue de créer des
    // types de billets sans avoir à préciser accessType/eventDayIds — comme avant.
    if (accessTypeProvided || eventDayIdsProvided) {
      resolvedAccessType = accessTypeProvided ? accessType : TicketAccessType.SINGLE_DAY;
      const result = await resolveEventDayLinks(eventId, resolvedAccessType, eventDayIds);
      if ("error" in result) {
        return res.status(400).json({ error: result.error });
      }
      daysResult = result;
    }

    const count = await prisma.ticketType.count({ where: { eventId } });

    const ticketType = await prisma.$transaction(async (tx) => {
      const created = await tx.ticketType.create({
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
          accessType: resolvedAccessType,
        },
      });

      if (daysResult.eventDayIds.length > 0) {
        await tx.ticketTypeEventDay.createMany({
          data: daysResult.eventDayIds.map((eventDayId) => ({
            ticketTypeId: created.id,
            eventDayId,
          })),
        });
      }

      return tx.ticketType.findUniqueOrThrow({
        where: { id: created.id },
        include: ticketTypeWithDaysInclude,
      });
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
      include: ticketTypeWithDaysInclude,
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

    const {
      name,
      description,
      price,
      totalSeats,
      seatMapZone,
      salesStart,
      salesEnd,
      accessType,
      eventDayIds,
    } = req.body;

    const accessTypeProvided = accessType !== undefined;
    const eventDayIdsProvided = eventDayIds !== undefined;

    if (accessTypeProvided && !isValidAccessType(accessType)) {
      return res
        .status(400)
        .json({ error: "accessType invalide (SINGLE_DAY, MULTI_DAY ou FULL_PASS)" });
    }

    const resolvedAccessType: TicketAccessType = accessTypeProvided
      ? accessType
      : ticketType.accessType;

    // newEventDayIds === null signifie "ne pas toucher aux liaisons TicketTypeEventDay existantes"
    // (cas où ni accessType ni eventDayIds ne changent).
    let newEventDayIds: string[] | null = null;

    if (accessTypeProvided || eventDayIdsProvided) {
      if (resolvedAccessType === TicketAccessType.FULL_PASS) {
        newEventDayIds = [];
      } else if (eventDayIdsProvided) {
        const daysResult = await resolveEventDayLinks(
          ticketType.eventId,
          resolvedAccessType,
          eventDayIds
        );
        if ("error" in daysResult) {
          return res.status(400).json({ error: daysResult.error });
        }
        newEventDayIds = daysResult.eventDayIds;
      } else {
        // accessType change vers SINGLE_DAY/MULTI_DAY sans fournir eventDayIds : impossible
        // de déduire une liaison valable (l'ancienne liste correspondait à l'ancien accessType).
        return res.status(400).json({
          error: "eventDayIds est requis quand accessType passe à SINGLE_DAY ou MULTI_DAY",
        });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.ticketType.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(price !== undefined && { price }),
          ...(totalSeats !== undefined && { totalSeats: Number(totalSeats) }),
          ...(seatMapZone !== undefined && { seatMapZone }),
          ...(salesStart !== undefined && { salesStart: salesStart ? new Date(salesStart) : null }),
          ...(salesEnd !== undefined && { salesEnd: salesEnd ? new Date(salesEnd) : null }),
          ...(accessTypeProvided && { accessType: resolvedAccessType }),
        },
      });

      if (newEventDayIds !== null) {
        await tx.ticketTypeEventDay.deleteMany({ where: { ticketTypeId: id } });
        if (newEventDayIds.length > 0) {
          await tx.ticketTypeEventDay.createMany({
            data: newEventDayIds.map((eventDayId) => ({ ticketTypeId: id, eventDayId })),
          });
        }
      }

      return tx.ticketType.findUniqueOrThrow({
        where: { id },
        include: ticketTypeWithDaysInclude,
      });
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