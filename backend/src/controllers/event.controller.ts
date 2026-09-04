import type { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import type { Prisma } from "@prisma/client";

export async function createEvent(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const {
      title,
      description,
      category,
      region,
      location,
      latitude,
      longitude,
      startDate,
      endDate,
      coverImageUrl,
      images,
      videoUrl,
      totalCapacity,
      conditions,
      refundPolicy,
    } = req.body;

    if (!title || !description || !category || !region || !location || !startDate || !totalCapacity) {
      return res.status(400).json({
        error: "Champs requis manquants (title, description, category, region, location, startDate, totalCapacity)",
      });
    }

    const event = await prisma.event.create({
      data: {
        title,
        description,
        category,
        region,
        location,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        coverImageUrl: coverImageUrl ?? null,
        images: images ?? [],
        videoUrl: videoUrl ?? null,
        totalCapacity: Number(totalCapacity),
        conditions: conditions ?? null,
        refundPolicy: refundPolicy ?? null,
        organizerId: req.userId,
      },
    });

    return res.status(201).json({ event });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur lors de la création de l'événement" });
  }
}

export async function updateEvent(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Paramètre id manquant" });

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: "Événement introuvable" });

    if (event.organizerId !== req.userId && req.userRole !== "ADMIN") {
      return res.status(403).json({ error: "Tu n'es pas autorisé à modifier cet événement" });
    }

    const {
      title,
      description,
      category,
      region,
      location,
      latitude,
      longitude,
      startDate,
      endDate,
      coverImageUrl,
      images,
      videoUrl,
      totalCapacity,
      conditions,
      refundPolicy,
    } = req.body;

    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(region !== undefined && { region }),
        ...(location !== undefined && { location }),
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(coverImageUrl !== undefined && { coverImageUrl }),
        ...(images !== undefined && { images }),
        ...(videoUrl !== undefined && { videoUrl }),
        ...(totalCapacity !== undefined && { totalCapacity: Number(totalCapacity) }),
        ...(conditions !== undefined && { conditions }),
        ...(refundPolicy !== undefined && { refundPolicy }),
      },
    });

    return res.json({ event: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur lors de la mise à jour" });
  }
}

export async function deleteEvent(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Paramètre id manquant" });

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: "Événement introuvable" });

    if (event.organizerId !== req.userId && req.userRole !== "ADMIN") {
      return res.status(403).json({ error: "Tu n'es pas autorisé à supprimer cet événement" });
    }

    await prisma.event.delete({ where: { id } });

    return res.json({ message: "Événement supprimé" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur lors de la suppression" });
  }
}

export async function publishEvent(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Paramètre id manquant" });

    const event = await prisma.event.findUnique({
      where: { id },
      include: { ticketTypes: true },
    });
    if (!event) return res.status(404).json({ error: "Événement introuvable" });

    if (event.organizerId !== req.userId && req.userRole !== "ADMIN") {
      return res.status(403).json({ error: "Tu n'es pas autorisé à publier cet événement" });
    }

    if (event.ticketTypes.length === 0) {
      return res.status(400).json({ error: "Ajoute au moins un type de billet avant de publier" });
    }

    const updated = await prisma.event.update({
      where: { id },
      data: { status: "PUBLISHED" },
    });

    return res.json({ event: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function listEvents(req: Request, res: Response) {
  try {
    const { category, region, search, page = "1", limit = "12" } = req.query;

    const where: Prisma.EventWhereInput = { status: "PUBLISHED" };

    if (typeof category === "string") where.category = category;
    if (typeof region === "string") where.region = region;
    if (typeof search === "string" && search.trim() !== "") {
      where.title = { contains: search, mode: "insensitive" };
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 12));

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { startDate: "asc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: { ticketTypes: { where: { isActive: true } } },
      }),
      prisma.event.count({ where }),
    ]);

    return res.json({ events, total, page: pageNum, limit: limitNum });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getEvent(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Paramètre id manquant" });

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        ticketTypes: { orderBy: { order: "asc" } },
        organizer: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        comments: {
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!event) return res.status(404).json({ error: "Événement introuvable" });

    const isOwner = req.userId === event.organizerId;
    const isAdmin = req.userRole === "ADMIN";

    if (event.status !== "PUBLISHED" && !isOwner && !isAdmin) {
      return res.status(404).json({ error: "Événement introuvable" });
    }

    return res.json({ event });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function listMyEvents(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const events = await prisma.event.findMany({
      where: { organizerId: req.userId },
      orderBy: { createdAt: "desc" },
      include: { ticketTypes: true },
    });

    return res.json({ events });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getRegionStats(req: Request, res: Response) {
  try {
    const stats = await prisma.event.groupBy({
      by: ["region"],
      where: { status: "PUBLISHED" },
      _count: { _all: true },
    });

    return res.json({
      stats: stats.map((s) => ({ region: s.region, count: s._count._all })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}