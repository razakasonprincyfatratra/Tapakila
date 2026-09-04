import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.middleware.js";

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ error: "Accès réservé à ce rôle" });
    }
    next();
  };
}