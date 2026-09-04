import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const JWT_SECRET: Secret = process.env.JWT_SECRET as string;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID as string;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET as string;

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

function generateToken(user: { id: string; role: string }): string {
  const options: SignOptions = { expiresIn: "7d" };
  return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, options);
}

function publicUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
  };
}

export async function register(req: Request, res: Response) {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: "Tous les champs sont requis" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: "Un compte existe déjà avec cet email" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, firstName, lastName },
    });

    return res.status(201).json({ user: publicUser(user), token: generateToken(user) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur lors de l'inscription" });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    return res.json({ user: publicUser(user), token: generateToken(user) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur lors de la connexion" });
  }
}

export async function me(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
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

export async function googleLogin(req: Request, res: Response) {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: "idToken manquant" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return res.status(401).json({ error: "Token Google invalide" });
    }

    const googleId = payload.sub;
    const email = payload.email;
    const firstName = payload.given_name ?? "Utilisateur";
    const lastName = payload.family_name ?? "";
    const avatarUrl = payload.picture ?? null;

    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      const existingByEmail = await prisma.user.findUnique({ where: { email } });

      if (existingByEmail) {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { googleId, avatarUrl: existingByEmail.avatarUrl ?? avatarUrl },
        });
      } else {
        user = await prisma.user.create({
          data: { email, googleId, firstName, lastName, avatarUrl },
        });
      }
    }

    return res.json({ user: publicUser(user), token: generateToken(user) });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Échec de l'authentification Google" });
  }
}

export async function facebookLogin(req: Request, res: Response) {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: "accessToken manquant" });
    }

    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`
    );
    const debugData = await debugRes.json();

    if (!debugData?.data?.is_valid || debugData.data.app_id !== FACEBOOK_APP_ID) {
      return res.status(401).json({ error: "Token Facebook invalide" });
    }

    const profileRes = await fetch(
      `https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture&access_token=${accessToken}`
    );
    const profile = await profileRes.json();

    if (!profile?.email) {
      return res.status(401).json({ error: "Impossible de récupérer l'email Facebook (vérifie les permissions)" });
    }

    const facebookId = profile.id as string;
    const email = profile.email as string;
    const firstName = profile.first_name ?? "Utilisateur";
    const lastName = profile.last_name ?? "";
    const avatarUrl = profile.picture?.data?.url ?? null;

    let user = await prisma.user.findUnique({ where: { facebookId } });

    if (!user) {
      const existingByEmail = await prisma.user.findUnique({ where: { email } });

      if (existingByEmail) {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { facebookId, avatarUrl: existingByEmail.avatarUrl ?? avatarUrl },
        });
      } else {
        user = await prisma.user.create({
          data: { email, facebookId, firstName, lastName, avatarUrl },
        });
      }
    }

    return res.json({ user: publicUser(user), token: generateToken(user) });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Échec de l'authentification Facebook" });
  }
}