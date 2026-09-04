"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getEvent, createReservation, confirmReservation, type Event, type Reservation } from "@/lib/api";

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const router = useRouter();
  const { user, token } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reserving, setReserving] = useState<string | null>(null);
  const [pendingReservation, setPendingReservation] = useState<Reservation | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmedReservation, setConfirmedReservation] = useState<Reservation | null>(null);

  useEffect(() => {
    getEvent(eventId, token ?? undefined)
      .then((res) => setEvent(res.event))
      .catch((err) => setError(err instanceof Error ? err.message : "Événement introuvable"))
      .finally(() => setLoading(false));
  }, [eventId, token]);

  function getQuantity(ticketTypeId: string) {
    return quantities[ticketTypeId] ?? 1;
  }

  function setQuantity(ticketTypeId: string, value: number) {
    setQuantities((prev) => ({ ...prev, [ticketTypeId]: Math.max(1, value) }));
  }

  async function handleReserve(ticketTypeId: string) {
    if (!user || !token) {
      router.push("/auth");
      return;
    }

    setError(null);
    setReserving(ticketTypeId);
    try {
      const { reservation } = await createReservation(token, {
        ticketTypeId,
        quantity: getQuantity(ticketTypeId),
      });
      setPendingReservation(reservation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer la réservation");
    } finally {
      setReserving(null);
    }
  }

  async function handleSimulatePayment() {
    if (!token || !pendingReservation) return;
    setError(null);
    setConfirming(true);
    try {
      const { reservation } = await confirmReservation(token, pendingReservation.id);
      setConfirmedReservation(reservation);
      setPendingReservation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de confirmer le paiement");
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B14] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Chargement...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#0B0B14] flex items-center justify-center px-4">
        <p className="text-red-400 text-sm">{error ?? "Événement introuvable"}</p>
      </div>
    );
  }

  const dateLabel = new Date(event.startDate).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const activeTicketTypes = (event.ticketTypes ?? []).filter((t) => t.isActive);

  return (
    <div className="min-h-screen bg-[#0B0B14]">
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent">
              TAPAKILA
            </span>
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-10">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 transition">
          ← Retour aux événements
        </Link>

        <div className="h-56 sm:h-72 bg-gradient-to-br from-purple-900/40 via-pink-900/30 to-orange-900/40 rounded-2xl mt-4 overflow-hidden relative">
          {event.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.coverImageUrl} alt={event.title} className="w-full h-full object-cover" />
          )}
          <span className="absolute top-4 left-4 text-xs bg-black/60 text-white px-3 py-1 rounded-full">
            {event.category}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white mt-6">{event.title}</h1>
        <p className="text-gray-400 text-sm mt-2">
          {dateLabel} · {event.location} · {event.region}
        </p>

        <p className="text-gray-300 text-sm mt-6 whitespace-pre-line leading-relaxed">
          {event.description}
        </p>

        {(event.conditions || event.refundPolicy) && (
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            {event.conditions && (
              <div className="bg-[#13131F] border border-white/10 rounded-xl p-4">
                <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-1">Conditions</h3>
                <p className="text-sm text-gray-300">{event.conditions}</p>
              </div>
            )}
            {event.refundPolicy && (
              <div className="bg-[#13131F] border border-white/10 rounded-xl p-4">
                <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-1">Remboursement</h3>
                <p className="text-sm text-gray-300">{event.refundPolicy}</p>
              </div>
            )}
          </div>
        )}

        <h2 className="text-white font-semibold mt-10 mb-4">Billets</h2>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
            {error}
          </p>
        )}

        {pendingReservation && (
          <div className="bg-[#13131F] border border-orange-500/30 rounded-xl p-5 mb-6">
            <h3 className="text-white font-medium text-sm mb-1">Réservation en attente de paiement</h3>
            <p className="text-gray-400 text-sm mb-4">
              Total : {Number(pendingReservation.totalAmount).toLocaleString("fr-FR")} Ar — paiement Efaina
              pas encore disponible, tu peux simuler la confirmation pour l'instant.
            </p>
            <button
              onClick={handleSimulatePayment}
              disabled={confirming}
              className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {confirming ? "Confirmation..." : "Simuler le paiement"}
            </button>
          </div>
        )}

        {confirmedReservation && (
          <div className="bg-[#13131F] border border-green-500/30 rounded-xl p-5 mb-6">
            <h3 className="text-white font-medium text-sm mb-1">Réservation confirmée 🎉</h3>
            <p className="text-gray-400 text-sm mb-4">Ton billet électronique est prêt.</p>
            <Link
              href="/tickets"
              className="inline-block bg-white/10 border border-white/10 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-white/15 transition"
            >
              Voir mes billets →
            </Link>
          </div>
        )}

        {activeTicketTypes.length === 0 && (
          <p className="text-gray-500 text-sm">Aucun billet disponible pour le moment.</p>
        )}

        <div className="space-y-3">
          {activeTicketTypes.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-[#13131F] border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap"
            >
              <div>
                <h3 className="text-white font-medium text-sm">{ticket.name}</h3>
                {ticket.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{ticket.description}</p>
                )}
                <p className="text-sm text-gray-300 mt-1">
                  {Number(ticket.price).toLocaleString("fr-FR")} Ar · {ticket.availableSeats} places
                  restantes
                </p>
              </div>

              {ticket.availableSeats > 0 ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={ticket.availableSeats}
                    value={getQuantity(ticket.id)}
                    onChange={(e) => setQuantity(ticket.id, Number(e.target.value))}
                    className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => handleReserve(ticket.id)}
                    disabled={reserving === ticket.id}
                    className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                  >
                    {reserving === ticket.id ? "..." : "Réserver"}
                  </button>
                </div>
              ) : (
                <span className="text-xs text-gray-500 bg-white/5 px-3 py-1.5 rounded-lg">Épuisé</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}