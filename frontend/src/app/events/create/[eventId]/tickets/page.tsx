"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  getEvent,
  listTicketTypes,
  createTicketType,
  updateTicketType,
  toggleTicketType,
  deleteTicketType,
  reorderTicketTypes,
  publishEvent,
  type Event,
  type TicketType,
} from "@/lib/api";

export default function ConfigureTicketsPage() {
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const { user, token, loading: authLoading } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [totalSeats, setTotalSeats] = useState("");
  const [seatMapZone, setSeatMapZone] = useState("");
  const [salesStart, setSalesStart] = useState("");
  const [salesEnd, setSalesEnd] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  async function loadData() {
    if (!token) return;
    try {
      const [eventRes, ticketsRes] = await Promise.all([
        getEvent(eventId, token),
        listTicketTypes(eventId, token),
      ]);
      setEvent(eventRes.event);
      setTicketTypes(ticketsRes.ticketTypes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger l'événement");
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
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, token, eventId]);

  function resetForm() {
    setName("");
    setDescription("");
    setPrice("");
    setTotalSeats("");
    setSeatMapZone("");
    setSalesStart("");
    setSalesEnd("");
    setEditingId(null);
  }

  function startEdit(ticket: TicketType) {
    setEditingId(ticket.id);
    setName(ticket.name);
    setDescription(ticket.description ?? "");
    setPrice(ticket.price);
    setTotalSeats(String(ticket.totalSeats));
    setSeatMapZone(ticket.seatMapZone ?? "");
    setSalesStart(ticket.salesStart ? ticket.salesStart.slice(0, 16) : "");
    setSalesEnd(ticket.salesEnd ? ticket.salesEnd.slice(0, 16) : "");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) return;

    setSubmitting(true);
    try {
      const payload = {
        name,
        description: description || undefined,
        price: Number(price),
        totalSeats: Number(totalSeats),
        seatMapZone: seatMapZone || undefined,
        salesStart: salesStart ? new Date(salesStart).toISOString() : undefined,
        salesEnd: salesEnd ? new Date(salesEnd).toISOString() : undefined,
      };

      if (editingId) {
        await updateTicketType(token, editingId, payload);
      } else {
        await createTicketType(token, eventId, payload);
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(id: string) {
    if (!token) return;
    try {
      await toggleTicketType(token, id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    if (!confirm("Supprimer ce type de billet ?")) return;
    try {
      await deleteTicketType(token, id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    if (!token) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= ticketTypes.length) return;

    const reordered = [...ticketTypes];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setTicketTypes(reordered);

    try {
      await reorderTicketTypes(
        token,
        eventId,
        reordered.map((t, i) => ({ id: t.id, position: i }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
      await loadData();
    }
  }

  async function handlePublish() {
    if (!token) return;
    setError(null);
    setPublishing(true);
    try {
      await publishEvent(token, eventId);
      setPublished(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setPublishing(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0B0B14] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Chargement...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#0B0B14] flex items-center justify-center">
        <p className="text-red-400 text-sm">{error ?? "Événement introuvable"}</p>
      </div>
    );
  }

  if (event.organizerId !== user?.id && user?.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-[#0B0B14] flex items-center justify-center">
        <p className="text-red-400 text-sm">Tu n'es pas autorisé à gérer cet événement.</p>
      </div>
    );
  }

  if (published) {
    return (
      <div className="min-h-screen bg-[#0B0B14] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-[#13131F] border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold text-white mb-2">Événement publié 🎉</h1>
          <p className="text-gray-400 text-sm mb-6">
            "{event.title}" est maintenant visible par les participants.
          </p>
          <Link
            href="/"
            className="inline-block w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B14] px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block text-2xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent">
              TAPAKILA
            </span>
          </Link>
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/10 text-gray-400 text-xs flex items-center justify-center font-semibold">
                ✓
              </div>
              <span className="text-gray-500 text-sm">Informations générales</span>
            </div>
            <div className="w-8 h-px bg-white/20" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-r from-purple-600 to-orange-500 text-white text-xs flex items-center justify-center font-semibold">
                2
              </div>
              <span className="text-white text-sm font-medium">Configurer les billets</span>
            </div>
          </div>
          <p className="text-gray-400 text-sm mt-3">{event.title}</p>
        </div>

        {ticketTypes.length > 0 && (
          <div className="space-y-3 mb-6">
            {ticketTypes.map((ticket, index) => (
              <div
                key={ticket.id}
                className={`bg-[#13131F] border rounded-xl p-4 flex items-start justify-between gap-4 ${
                  ticket.isActive ? "border-white/10" : "border-white/5 opacity-50"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium text-sm">{ticket.name}</h3>
                    {!ticket.isActive && (
                      <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                        Désactivé
                      </span>
                    )}
                  </div>
                  {ticket.description && (
                    <p className="text-xs text-gray-500 mt-1">{ticket.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {Number(ticket.price).toLocaleString("fr-FR")} Ar · {ticket.availableSeats}/
                    {ticket.totalSeats} places
                    {ticket.seatMapZone ? ` · Zone ${ticket.seatMapZone}` : ""}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-white disabled:opacity-30 text-xs px-1.5"
                      title="Monter"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === ticketTypes.length - 1}
                      className="text-gray-400 hover:text-white disabled:opacity-30 text-xs px-1.5"
                      title="Descendre"
                    >
                      ↓
                    </button>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => startEdit(ticket)}
                      className="text-purple-400 hover:text-purple-300"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(ticket.id)}
                      className="text-gray-400 hover:text-gray-200"
                    >
                      {ticket.isActive ? "Désactiver" : "Activer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(ticket.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-[#13131F] border border-white/10 rounded-2xl p-8 shadow-xl">
          <h2 className="text-white text-sm font-semibold mb-4">
            {editingId ? "Modifier le type de billet" : "Ajouter un type de billet"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nom</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Early Bird, Standard, VIP..."
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Zone (optionnel)</label>
                <input
                  type="text"
                  value={seatMapZone}
                  onChange={(e) => setSeatMapZone(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Fosse, Balcon A..."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Description — optionnel</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Accès prioritaire, boisson offerte..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Prix (Ar)</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="25000"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Quantité disponible</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={totalSeats}
                  onChange={(e) => setTotalSeats(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Début des ventes — optionnel</label>
                <input
                  type="datetime-local"
                  value={salesStart}
                  onChange={(e) => setSalesStart(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Fin des ventes — optionnel</label>
                <input
                  type="datetime-local"
                  value={salesEnd}
                  onChange={(e) => setSalesEnd(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-white/5 border border-white/10 text-white text-sm py-2.5 rounded-lg hover:bg-white/10 transition"
                >
                  Annuler
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50"
              >
                {submitting ? "Enregistrement..." : editingId ? "Mettre à jour" : "Ajouter le billet"}
              </button>
            </div>
          </form>
        </div>

        <button
          type="button"
          onClick={handlePublish}
          disabled={publishing || ticketTypes.length === 0}
          className="w-full mt-6 bg-white/10 border border-white/10 text-white font-medium py-3 rounded-lg hover:bg-white/15 transition disabled:opacity-40"
        >
          {publishing
            ? "Publication..."
            : ticketTypes.length === 0
              ? "Ajoute au moins un type de billet pour publier"
              : "Publier l'événement"}
        </button>
      </div>
    </div>
  );
}