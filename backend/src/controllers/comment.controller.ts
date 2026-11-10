import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const MAX_COMMENT_LENGTH = 1000;
const PAGE_SIZE = 20;
const RATE_LIMIT_PER_MINUTE = 5;

function param(req: Request, name: string): string | null {
  const v = req.params[name];
  return typeof v === "string" && v !== "" ? v : null;
}

/** Les commentaires ne sont visibles que pour les événements publics. */
async function findPublicEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, status: true, organizerId: true },
  });
  if (!event || (event.status !== "PUBLISHED" && event.status !== "COMPLETED")) return null;
  return event;
}

const commentSelect = {
  id: true,
  content: true,
  createdAt: true,
  user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

export async function listComments(req: Request, res: Response) {
  try {
    const eventId = param(req, "eventId");
    if (!eventId) return res.status(400).json({ error: "Événement invalide" });

    const event = await findPublicEvent(eventId);
    if (!event) return res.status(404).json({ error: "Événement introuvable" });

    const cursor = typeof req.query.cursor === "string" && req.query.cursor !== "" ? req.query.cursor : null;

    const [items, total] = await Promise.all([
      prisma.comment.findMany({
        where: { eventId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: commentSelect,
      }),
      prisma.comment.count({ where: { eventId } }),
    ]);

    const hasMore = items.length > PAGE_SIZE;
    const comments = hasMore ? items.slice(0, PAGE_SIZE) : items;
    const last = comments[comments.length - 1];

    return res.json({
      comments,
      total,
      nextCursor: hasMore && last ? last.id : null,
      organizerId: event.organizerId,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function createComment(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const eventId = param(req, "eventId");
    if (!eventId) return res.status(400).json({ error: "Événement invalide" });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (content === "") {
      return res.status(400).json({ error: "Le commentaire ne peut pas être vide" });
    }
    if (content.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ error: `Le commentaire est trop long (${MAX_COMMENT_LENGTH} caractères maximum)` });
    }

    const event = await findPublicEvent(eventId);
    if (!event) return res.status(404).json({ error: "Événement introuvable" });

    // Limite anti-spam
    const recent = await prisma.comment.count({
      where: { userId: req.userId, createdAt: { gte: new Date(Date.now() - 60_000) } },
    });
    if (recent >= RATE_LIMIT_PER_MINUTE) {
      return res.status(429).json({ error: "Vous publiez trop vite. Réessayez dans une minute." });
    }

    const comment = await prisma.comment.create({
      data: { userId: req.userId, eventId, content },
      select: commentSelect,
    });

    return res.status(201).json({ comment });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur lors de la publication" });
  }
}

export async function deleteComment(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const commentId = param(req, "commentId");
    if (!commentId) return res.status(400).json({ error: "Commentaire invalide" });

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, event: { select: { organizerId: true } } },
    });
    if (!comment) return res.status(404).json({ error: "Commentaire introuvable" });

    // Le rôle est relu en base : on ne se fie pas à un rôle potentiellement périmé dans le token.
    const requester = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });

    const allowed =
      comment.userId === req.userId ||
      comment.event.organizerId === req.userId ||
      requester?.role === "ADMIN";

    if (!allowed) return res.status(403).json({ error: "Action non autorisée" });

    await prisma.comment.delete({ where: { id: commentId } });
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur lors de la suppression" });
  }
}