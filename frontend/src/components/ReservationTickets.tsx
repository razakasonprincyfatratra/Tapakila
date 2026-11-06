"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TicketQRCode } from "@/components/TicketQRCode";
import {
  listReservationTickets,
  type ReservationTicket,
  type TicketStatus,
} from "@/lib/api";

const PAGE_SIZE = 50;

const STATUS_LABELS: Record<TicketStatus, string> = {
  PENDING: "En attente",
  VALID: "Valide",
  USED: "Utilisé",
  CANCELLED: "Annulé",
  REFUNDED: "Remboursé",
  EXPIRED: "Expiré",
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  PENDING: "bg-orange-500/15 text-orange-400",
  VALID: "bg-green-500/15 text-green-400",
  USED: "bg-white/10 text-gray-400",
  CANCELLED: "bg-red-500/10 text-red-400",
  REFUNDED: "bg-white/10 text-gray-400",
  EXPIRED: "bg-white/10 text-gray-500",
};

interface ReservationTicketsProps {
  token: string;
  reservationId: string;
  /** Nombre total de billets de la réservation (pour l'affichage "Billet 1/3"). */
  total: number;
  /** Nom de l'événement, utilisé dans le nom du fichier téléchargé. */
  eventTitle?: string;
}

/**
 * Affiche un QR code par billet réservé (3 billets = 3 QR codes uniques).
 * Les billets sont chargés par pages de 50 : une commande peut en compter des centaines.
 * Aucun nom n'est demandé : les billets sont anonymes et peuvent être transmis tels quels.
 */
export function ReservationTickets({ token, reservationId, total, eventTitle }: ReservationTicketsProps) {
  const [tickets, setTickets] = useState<ReservationTicket[]>([]);
  const [usedCount, setUsedCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (pageToLoad: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await listReservationTickets(token, reservationId, pageToLoad, PAGE_SIZE);
        setTickets((prev) => (pageToLoad === 1 ? data.tickets : [...prev, ...data.tickets]));
        setUsedCount(data.usedCount);
        setPage(pageToLoad);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger les billets");
      } finally {
        setLoading(false);
      }
    },
    [token, reservationId]
  );

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  const hasMore = tickets.length < total;

  return (
    <div className="mt-4 pt-4 border-t border-white/10">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400">
          {total} billet{total > 1 ? "s" : ""} · {usedCount} utilisé{usedCount > 1 ? "s" : ""}
        </p>
        <p className="text-[11px] text-gray-600">1 QR code = 1 personne</p>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} total={total} eventTitle={eventTitle} />
        ))}
      </div>

      {loading && <p className="text-xs text-gray-500 text-center mt-4">Chargement...</p>}

      {!loading && hasMore && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => loadPage(page + 1)}
            className="text-xs text-purple-400 hover:text-purple-300 transition"
          >
            Voir plus de billets ({total - tickets.length} restants)
          </button>
        </div>
      )}
    </div>
  );
}

function TicketCard({
  ticket,
  total,
  eventTitle,
}: {
  ticket: ReservationTicket;
  total: number;
  eventTitle?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const usable = ticket.status === "VALID";

  function handleDownload() {
    const canvas = wrapperRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    const safeTitle = (eventTitle ?? "billet").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    link.download = `tapakila-${safeTitle}-${ticket.number}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="bg-[#0F0F1A] border border-white/10 rounded-xl p-4 flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-3">
        <span className="text-xs text-white font-medium">
          Billet {ticket.number}/{total}
        </span>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_STYLES[ticket.status]}`}>
          {STATUS_LABELS[ticket.status]}
        </span>
      </div>

      <div ref={wrapperRef} className={`bg-white p-2.5 rounded-lg ${usable ? "" : "opacity-40"}`}>
        <TicketQRCode value={ticket.qrCode} size={140} as="canvas" />
      </div>

      <p className="text-[11px] text-gray-500 mt-3">Code de secours (si pas de réseau) :</p>
      <p className="text-white font-mono text-sm tracking-widest mt-0.5">{ticket.backupCode}</p>

      {ticket.status === "USED" && ticket.usedAt && (
        <p className="text-[11px] text-gray-500 mt-2">
          Scanné le {new Date(ticket.usedAt).toLocaleString("fr-FR")}
        </p>
      )}

      {usable && (
        <button
          onClick={handleDownload}
          className="mt-3 text-xs text-gray-400 hover:text-white transition"
        >
          Télécharger (PNG)
        </button>
      )}
    </div>
  );
}

export default ReservationTickets;