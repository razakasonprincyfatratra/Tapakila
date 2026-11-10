import type { Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const profileSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  avatarUrl: true,
  phone: true,
  city: true,
  birthDate: true,
  createdAt: true,
} as const;

const PHONE_REGEX = /^\+?[0-9 .\-()]{6,20}$/;

export async function getProfile(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: profileSelect,
    });

    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    return res.json({ user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function updateProfile(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      city?: string | null;
      birthDate?: Date | null;
    } = {};

    // Seuls ces champs sont modifiables : email, rôle, mot de passe et avatar sont protégés.

    if (body.firstName !== undefined) {
      if (typeof body.firstName !== "string" || body.firstName.trim() === "") {
        return res.status(400).json({ error: "Le prénom est requis" });
      }
      if (body.firstName.trim().length > 60) {
        return res.status(400).json({ error: "Le prénom est trop long (60 caractères maximum)" });
      }
      data.firstName = body.firstName.trim();
    }

    if (body.lastName !== undefined) {
      if (typeof body.lastName !== "string" || body.lastName.trim() === "") {
        return res.status(400).json({ error: "Le nom est requis" });
      }
      if (body.lastName.trim().length > 60) {
        return res.status(400).json({ error: "Le nom est trop long (60 caractères maximum)" });
      }
      data.lastName = body.lastName.trim();
    }

    if (body.phone !== undefined) {
      if (body.phone === null || (typeof body.phone === "string" && body.phone.trim() === "")) {
        data.phone = null;
      } else if (typeof body.phone === "string" && PHONE_REGEX.test(body.phone.trim())) {
        data.phone = body.phone.trim();
      } else {
        return res.status(400).json({ error: "Numéro de téléphone invalide" });
      }
    }

    if (body.city !== undefined) {
      if (body.city === null || (typeof body.city === "string" && body.city.trim() === "")) {
        data.city = null;
      } else if (typeof body.city === "string" && body.city.trim().length <= 80) {
        data.city = body.city.trim();
      } else {
        return res.status(400).json({ error: "Ville invalide (80 caractères maximum)" });
      }
    }

    if (body.birthDate !== undefined) {
      if (body.birthDate === null || (typeof body.birthDate === "string" && body.birthDate.trim() === "")) {
        data.birthDate = null;
      } else if (typeof body.birthDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.birthDate)) {
        const parsed = new Date(`${body.birthDate}T00:00:00.000Z`);
        if (Number.isNaN(parsed.getTime()) || parsed > new Date() || parsed.getUTCFullYear() < 1900) {
          return res.status(400).json({ error: "Date de naissance invalide" });
        }
        data.birthDate = parsed;
      } else {
        return res.status(400).json({ error: "Date de naissance invalide (format AAAA-MM-JJ)" });
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Aucune modification fournie" });
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: profileSelect,
    });

    return res.json({ user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur lors de la mise à jour du profil" });
  }
}