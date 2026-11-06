import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";

// Taille des lots pour les grosses commandes (ex: 1 000 billets => 10 lots de 100).
const BATCH_SIZE = 100;

// Alphabet sans caractères ambigus (0/O, 1/I...) pour le code de secours.
const BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateBackupCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += BACKUP_ALPHABET[crypto.randomInt(0, BACKUP_ALPHABET.length)];
  }
  return code;
}

/**
 * Génère un billet individuel par place réservée (quantity = 3 => 3 billets,
 * 3 QR codes uniques). À appeler DANS une prisma.$transaction, au moment où la
 * réservation passe en CONFIRMED.
 *
 * Garanties :
 * - Jamais plus de `quantity` billets : la contrainte @@unique([reservationId, number])
 *   empêche les doublons, et on vérifie le total à la fin.
 * - Idempotent : si des billets existent déjà (appel répété), seuls les numéros
 *   manquants sont créés.
 * - Le QR contient uniquement un token aléatoire (UUID v4), aucune donnée personnelle.
 */
export async function generateTicketsForReservation(
  tx: Prisma.TransactionClient,
  params: { reservationId: string; eventId: string; quantity: number }
): Promise<void> {
  const { reservationId, eventId, quantity } = params;

  const existing = await tx.ticket.findMany({
    where: { reservationId },
    select: { number: true },
  });
  const existingNumbers = new Set(existing.map((t) => t.number));

  const missing: number[] = [];
  for (let n = 1; n <= quantity; n++) {
    if (!existingNumbers.has(n)) missing.push(n);
  }

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batchNumbers = missing.slice(i, i + BATCH_SIZE);

    // Codes de secours uniques à l'intérieur du lot
    const usedInBatch = new Set<string>();
    const data = batchNumbers.map((number) => {
      let backupCode = generateBackupCode();
      while (usedInBatch.has(backupCode)) backupCode = generateBackupCode();
      usedInBatch.add(backupCode);

      return {
        reservationId,
        eventId,
        number,
        qrCode: crypto.randomUUID(),
        backupCode,
        status: "VALID" as const,
      };
    });

    await tx.ticket.createMany({ data });
  }

  const total = await tx.ticket.count({ where: { reservationId } });
  if (total !== quantity) {
    // Annule toute la transaction : on ne laisse jamais une génération partielle.
    throw new Error("TICKET_GENERATION_MISMATCH");
  }
}