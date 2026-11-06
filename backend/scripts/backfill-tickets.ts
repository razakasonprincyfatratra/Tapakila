/**
 * Rattrapage des réservations CONFIRMÉES créées avant les billets individuels.
 *
 * Pour chaque réservation confirmée sans billet :
 * - crée `quantity` billets (un QR unique chacun) ;
 * - le billet n°1 reprend l'ancien qrCode / backupCode de la réservation, donc les QR
 *   déjà distribués restent valides ;
 * - si l'ancienne réservation était déjà scannée (checkedInAt), le billet n°1 passe en USED ;
 * - les anciens CheckIn (événements multi-jours) sont rattachés au billet n°1.
 *
 * Idempotent : peut être relancé sans créer de doublons.
 *
 * Usage (depuis backend/) :
 *   npx tsx scripts/backfill-tickets.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { generateTicketsForReservation } from "../src/lib/ticketGenerator.js";

async function main() {
  const reservations = await prisma.reservation.findMany({
    where: { status: "CONFIRMED", tickets: { none: {} } },
    select: {
      id: true,
      eventId: true,
      quantity: true,
      qrCode: true,
      backupCode: true,
      checkedInAt: true,
      checkedInById: true,
    },
  });

  console.log(`${reservations.length} réservation(s) à rattraper`);

  let done = 0;
  for (const r of reservations) {
    await prisma.$transaction(
      async (tx) => {
        await generateTicketsForReservation(tx, {
          reservationId: r.id,
          eventId: r.eventId,
          quantity: r.quantity,
        });

        const first = await tx.ticket.findUnique({
          where: { reservationId_number: { reservationId: r.id, number: 1 } },
        });
        if (!first) throw new Error(`Billet n°1 introuvable pour la réservation ${r.id}`);

        await tx.ticket.update({
          where: { id: first.id },
          data: {
            ...(r.qrCode ? { qrCode: r.qrCode } : {}),
            ...(r.backupCode ? { backupCode: r.backupCode } : {}),
            ...(r.checkedInAt
              ? { status: "USED" as const, usedAt: r.checkedInAt, usedById: r.checkedInById }
              : {}),
          },
        });

        await tx.checkIn.updateMany({
          where: { reservationId: r.id, ticketId: null },
          data: { ticketId: first.id },
        });
      },
      { maxWait: 10_000, timeout: 60_000 }
    );
    done++;
    console.log(`✔ ${r.id} (${r.quantity} billet(s)) — ${done}/${reservations.length}`);
  }

  console.log("Terminé.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());