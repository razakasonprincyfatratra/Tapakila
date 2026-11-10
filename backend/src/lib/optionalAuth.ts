import type { Request } from "express";
import jwt from "jsonwebtoken";

/**
 * Retourne l'id de l'utilisateur si un token valide est présent,
 * sinon null (sans jamais rejeter la requête). Utile pour les routes publiques
 * qui enrichissent leur réponse pour un utilisateur connecté.
 */
export function optionalUserId(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET as string);
    if (typeof payload === "object" && payload !== null && typeof payload.userId === "string") {
      return payload.userId;
    }
    return null;
  } catch {
    return null;
  }
}