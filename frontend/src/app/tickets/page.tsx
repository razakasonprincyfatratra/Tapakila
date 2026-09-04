"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TicketQRCode } from "@/components/TicketQRCode";
import { useAuth } from "@/context/AuthContext";
import {
  listMyReservations,
  confirmReservation,
  cancelReservation,
  type Reservation,
} from "@/lib/api";

export default function MyTicketsPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadReservations() {
    if (!token) return;
    try {
      const { reservations } = await listMyReservations(token);
      setReservations(reservations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger tes billets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user || !token) {
      router.push("/auth");
      return;
    }
    loadReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, token]);

  async function handleConfirm(id: string) {
    if (!token) return;
    setBusyId(id);
    try {
      await confirmReservation(token, id);
      await loadReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(id: string) {
    if (!token) return;
    if (!confirm("Annuler cette réservation ?")) return;
    setBusyId(id);
    try {
      await cancelReservation(token, id);
      await loadReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0B0B14] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B14]">
      <header className="border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent">
              TAPAKILA
            </span>
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-white transition">
            ← Accueil
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-white mb-6">Mes billets</h1>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
            {error}
          </p>
        )}

        {reservations.length === 0 && (
          <p className="text-gray-500 text-sm">
            Tu n'as pas encore de réservation.{" "}
            <Link href="/" className="text-purple-400 hover:text-purple-300">
              Découvrir des événements →
            </Link>
          </p>
        )}

        <div className="space-y-4">
          {reservations.map((reservation) => (
            <div
              key={reservation.id}
              className="bg-[#13131F] border border-white/10 rounded-2xl p-5"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-white font-semibold text-sm">
                      {reservation.event?.title ?? "Événement"}
                    </h2>
                    <StatusBadge status={reservation.status} />
                  </div>
                  {reservation.event && (
                    <p className="text-xs text-gray-500">
                      {new Date(reservation.event.startDate).toLocaleString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {reservation.event.location}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {reservation.ticketType?.name} × {reservation.quantity} —{" "}
                    {Number(reservation.totalAmount).toLocaleString("fr-FR")} Ar
                  </p>
                  {reservation.checkedInAt && (
                    <p className="text-xs text-green-400 mt-1">
                      Utilisé le{" "}
                      {new Date(reservation.checkedInAt).toLocaleString("fr-FR")}
                    </p>
                  )}
                </div>

                {reservation.status === "PENDING" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleCancel(reservation.id)}
                      disabled={busyId === reservation.id}
                      className="text-xs text-gray-400 hover:text-red-400 transition"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => handleConfirm(reservation.id)}
                      disabled={busyId === reservation.id}
                      className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white text-xs font-medium px-4 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                    >
                      {busyId === reservation.id ? "..." : "Simuler le paiement"}
                    </button>
                  </div>
                )}
              </div>

              {reservation.status === "CONFIRMED" && reservation.qrCode && (
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col items-center">
                  <div className="bg-white p-3 rounded-xl">
                    <TicketQRCode value={reservation.qrCode} size={140} />
                  </div>
                  <p className="text-xs text-gray-500 mt-3">Code de secours (si pas de réseau) :</p>
                  <p className="text-white font-mono text-sm tracking-widest mt-1">
                    {reservation.backupCode}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Reservation["status"] }) {
  const styles: Record<Reservation["status"], string> = {
    PENDING: "bg-orange-500/15 text-orange-400",
    CONFIRMED: "bg-green-500/15 text-green-400",
    CANCELLED: "bg-white/10 text-gray-500",
  };
  const labels: Record<Reservation["status"], string> = {
    PENDING: "En attente",
    CONFIRMED: "Confirmé",
    CANCELLED: "Annulé",
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}