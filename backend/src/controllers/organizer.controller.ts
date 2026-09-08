import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import type { OrganizerApplicationStatus, Prisma } from "@prisma/client";

export async function applyAsOrganizer(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    if (req.userRole === "ORGANIZER" || req.userRole === "ADMIN") {
      return res.status(400).json({ error: "Tu es déjà organisateur" });
    }

    const pending = await prisma.organizerApplication.findFirst({
      where: { userId: req.userId, status: "PENDING" },
    });
    if (pending) {
      return res.status(409).json({ error: "Une demande est déjà en cours de traitement" });
    }

    const {
      organizationName,
      phone,
      email,
      description,
      idDocumentUrl,
      businessRegistryUrl,
      logoUrl,
    } = req.body;

    if (!organizationName || !phone || !email || !description || !idDocumentUrl) {
      return res.status(400).json({
        error: "Champs requis manquants (organizationName, phone, email, description, idDocumentUrl)",
      });
    }

    const application = await prisma.organizerApplication.create({
      data: {
        userId: req.userId,
        organizationName,
        phone,
        email,
        description,
        idDocumentUrl,
        businessRegistryUrl: businessRegistryUrl ?? null,
        logoUrl: logoUrl ?? null,
      },
    });

    return res.status(201).json({ application });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur lors de la soumission de la demande" });
  }
}

export async function getMyApplication(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const application = await prisma.organizerApplication.findFirst({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ application });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function listApplications(req: AuthRequest, res: Response) {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;

    const where: Prisma.OrganizerApplicationWhereInput = {};
    if (status) where.status = status as OrganizerApplicationStatus;

    const applications = await prisma.organizerApplication.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ applications });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function approveApplication(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const { id } = req.params as { id: string };
    if (!id) return res.status(400).json({ error: "Paramètre id manquant" });

    const application = await prisma.organizerApplication.findUnique({ where: { id } });
    if (!application) {
      return res.status(404).json({ error: "Demande introuvable" });
    }
    if (application.status !== "PENDING") {
      return res.status(400).json({ error: "Cette demande a déjà été traitée" });
    }

    await prisma.$transaction([
      prisma.organizerApplication.update({
        where: { id },
        data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: req.userId },
      }),
      prisma.user.update({
        where: { id: application.userId },
        data: { role: "ORGANIZER" },
      }),
    ]);

    return res.json({ message: "Demande approuvée, l'utilisateur est maintenant organisateur" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function rejectApplication(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifié" });

    const { id } = req.params as { id: string };
    if (!id) return res.status(400).json({ error: "Paramètre id manquant" });

    const { rejectionReason } = req.body;

    const application = await prisma.organizerApplication.findUnique({ where: { id } });
    if (!application) {
      return res.status(404).json({ error: "Demande introuvable" });
    }
    if (application.status !== "PENDING") {
      return res.status(400).json({ error: "Cette demande a déjà été traitée" });
    }

    await prisma.organizerApplication.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: req.userId,
        rejectionReason: rejectionReason ?? null,
      },
    });

    return res.json({ message: "Demande refusée" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}