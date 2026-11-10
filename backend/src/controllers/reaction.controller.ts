import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { optionalUserId } from "../lib/optionalAuth.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const TYPES = ["LIKE", "INTERESTED"] as const;
type ReactionKind = (typeof TYPES)[number];

function param(req: Request, name: string): string | null {
  const v = req.params[name];
  return typeof v === "string" && v !== "" ? v : null;
}

async function isPublicEvent(eventId: string): Promise<boolean> {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { status: true } });
  return event !== null && (event.status === "PUBLISHED" || event.status === "COMPLETED");
}

async function summary(eventId: string, userId: string | null) {
  const [likes, interested, mine] = await Promise.all([
    prisma.eventReaction.count({ where: { eventId, type: "LIKE" } }),
    prisma.eventReaction.count({ where: { eventId, type: "INTERESTED" } }),
    userId
      ? prisma.eventReaction.findMany({ where: { eventId, userId }, select: { type: true } })
      : Promise.resolve([]),
  ]);

  return {
    counts: { LIKE: likes, INTERESTED: interested },
    mine: mine.map((m) => m.type),
  };
}

export async function getReactions(req: Request, res: Response) {
  try {
    const eventId = param(req, "eventId");
    if (!eventId) return res.status(400).json({ error: "Événement invalide" });
    if (!(await isPublicEvent(eventId))) return res.status(404).json({ error: "Événement introuvable" });

    return res.json(await summary(eventId, optionalUserId(req)));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

/** Bascule une réaction : l'ajoute si absente, la retire si déjà présente. */
export async function toggleReaction(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const eventId = param(req, "eventId");
    if (!eventId) return res.status(400).json({ error: "Événement invalide" });

    const type = (req.body as Record<string, unknown> | undefined)?.type;
    if (typeof type !== "string" || !TYPES.includes(type as ReactionKind)) {
      return res.status(400).json({ error: "Type de réaction invalide" });
    }
    const kind = type as ReactionKind;

    if (!(await isPublicEvent(eventId))) return res.status(404).json({ error: "Événement introuvable" });

    const key = { userId_eventId_type: { userId: req.userId, eventId, type: kind } };
    const existing = await prisma.eventReaction.findUnique({ where: key });

    if (existing) {
      await prisma.eventReaction.delete({ where: key });
    } else {
      try {
        await prisma.eventReaction.create({ data: { userId: req.userId, eventId, type: kind } });
      } catch (e) {
        // Double clic simultané : la réaction existe déjà, on ignore
        if (!(typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002")) throw e;
      }
    }

    return res.json(await summary(eventId, req.userId));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}