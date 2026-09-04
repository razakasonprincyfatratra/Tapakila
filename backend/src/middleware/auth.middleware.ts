import type { Request, Response, NextFunction } from "express";
import jwt, { type Secret } from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

interface TokenPayload {
  userId: string;
  role: string;
}

const JWT_SECRET: Secret = process.env.JWT_SECRET as string;

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token manquant" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token manquant" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as TokenPayload;
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token invalide ou expiré" });
  }
}

/**
 * Comme authMiddleware, mais ne bloque jamais la requête :
 * si un token valide est présent, req.userId/userRole sont renseignés,
 * sinon la requête continue simplement sans utilisateur authentifié.
 * Utile pour des routes publiques (ex: détail d'un événement) qui doivent
 * quand même reconnaître le propriétaire ou un admin s'il est connecté.
 */
export function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as TokenPayload;
    req.userId = decoded.userId;
    req.userRole = decoded.role;
  } catch (error) {
    // Token invalide ou expiré : on continue simplement sans utilisateur authentifié
  }

  next();
}