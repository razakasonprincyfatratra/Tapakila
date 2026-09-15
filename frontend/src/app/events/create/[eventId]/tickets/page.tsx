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
  listEventDays,
  createEventDay,
  updateEventDay,
  deleteEventDay,
  reorderEventDays,
  publishEvent,
  type Event,
  type TicketType,
  type EventDay,
  type TicketAccessType,
} from "@/lib/api";

const ACCESS_TYPE_OPTIONS: { value: TicketAccessType; label: string; hint: string }[] = [
  { value: "SINGLE_DAY", label: "Journée unique", hint: "Valable pour un seul jour précis" },
  { value: "MULTI_DAY", label: "Plusieurs jours", hint: "Valable pour une sélection de jours" },
  { value: "FULL_PASS", label: "Pass complet", hint: "Valable pour tous les jours de l'événement" },
];

function formatDayLabel(day: EventDay): string {
  const dateLabel = new Date(day.date).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return day.label ? `${day.label} — ${dateLabel}` : dateLabel;
}

export default function ConfigureTicketsPage() {
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const { user, token, loading: authLoading } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [eventDays, setEventDays] = useState<EventDay[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- Formulaire type de billet ----
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [totalSeats, setTotalSeats] = useState("");
  const [seatMapZone, setSeatMapZone] = useState("");
  const [salesStart, setSalesStart] = useState("");
  const [salesEnd, setSalesEnd] = useState("");
  const [accessType, setAccessType] = useState<TicketAccessType>("SINGLE_DAY");
  const [selectedDayIds, setSelectedDayIds] = useState<string[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  // ---- Formulaire jour d'événement ----
  const [dayDate, setDayDate] = useState("");
  const [dayLabel, setDayLabel] = useState("");
  const [dayStartTime, setDayStartTime] = useState("");
  const [dayEndTime, setDayEndTime] = useState("");
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);
  const [daySubmitting, setDaySubmitting] = useState(false);

  const hasMultiDaySetup = eventDays.length > 0;

  async function loadData() {
    if (!token) return;
    try {
      const [eventRes, ticketsRes, daysRes] = await Promise.all([
        getEvent(eventId, token),
        listTicketTypes(eventId, token),
        listEventDays(eventId, token),
      ]);
      setEvent(eventRes.event);
      setTicketTypes(ticketsRes.ticketTypes);
      setEventDays(daysRes.eventDays);
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

  // ---------- Types de billets ----------

  function resetForm() {
    setName("");
    setDescription("");
    setPrice("");
    setTotalSeats("");
    setSeatMapZone("");
    setSalesStart("");
    setSalesEnd("");
    setAccessType("SINGLE_DAY");
    setSelectedDayIds([]);
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
    setAccessType(ticket.accessType ?? "SINGLE_DAY");
    setSelectedDayIds(ticket.eventDays?.map((link) => link.eventDayId) ?? []);
  }

  function toggleDaySelection(dayId: string) {
    setSelectedDayIds((prev) =>
      prev.includes(dayId) ? prev.filter((id) => id !== dayId) : [...prev, dayId]
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) return;

    // L'accès par jour ne s'applique que si l'événement a des jours définis.
    // Sinon on garde le comportement classique (aucun accessType/eventDayIds envoyé).
    if (hasMultiDaySetup) {
      if (accessType === "SINGLE_DAY" && selectedDayIds.length !== 1) {
        setError("Sélectionne exactement un jour pour un billet « Journée unique ».");
        return;
      }
      if (accessType === "MULTI_DAY" && selectedDayIds.length === 0) {
        setError("Sélectionne au moins un jour pour un billet « Plusieurs jours ».");
        return;
      }
    }

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
        ...(hasMultiDaySetup && {
          accessType,
          eventDayIds: accessType === "FULL_PASS" ? undefined : selectedDayIds,
        }),
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

  function accessSummary(ticket: TicketType): string | null {
    if (!hasMultiDaySetup) return null;

    const type = ticket.accessType ?? "SINGLE_DAY";
    if (type === "FULL_PASS") return "Pass complet · tous les jours";

    const days = ticket.eventDays?.map((link) => formatDayLabel(link.eventDay)) ?? [];
    if (days.length === 0) return null;
    return type === "SINGLE_DAY" ? `Jour : ${days[0]}` : `Jours : ${days.join(", ")}`;
  }

  // ---------- Jours de l'événement ----------

  function resetDayForm() {
    setDayDate("");
    setDayLabel("");
    setDayStartTime("");
    setDayEndTime("");
    setEditingDayId(null);
    setDayError(null);
  }

  function startEditDay(day: EventDay) {
    setEditingDayId(day.id);
    setDayDate(day.date.slice(0, 10));
    setDayLabel(day.label ?? "");
    setDayStartTime(day.startTime ? day.startTime.slice(0, 16) : "");
    setDayEndTime(day.endTime ? day.endTime.slice(0, 16) : "");
    setDayError(null);
  }

  async function handleDaySubmit(e: FormEvent) {
    e.preventDefault();
    setDayError(null);

    if (!token) return;
    if (!dayDate) {
      setDayError("La date est requise");
      return;
    }

    setDaySubmitting(true);
    try {
      const payload = {
        date: dayDate,
        label: dayLabel || undefined,
        startTime: dayStartTime ? new Date(dayStartTime).toISOString() : undefined,
        endTime: dayEndTime ? new Date(dayEndTime).toISOString() : undefined,
      };

      if (editingDayId) {
        await updateEventDay(token, eventId, editingDayId, payload);
      } else {
        await createEventDay(token, eventId, payload);
      }

      resetDayForm();
      await loadData();
    } catch (err) {
      setDayError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setDaySubmitting(false);
    }
  }

  async function handleDeleteDay(id: string) {
    if (!token) return;
    if (!confirm("Supprimer cette journée ?")) return;
    try {
      await deleteEventDay(token, eventId, id);
      await loadData();
    } catch (err) {
      setDayError(err instanceof Error ? err.message : "Une erreur est survenue");
    }
  }

  async function handleMoveDay(index: number, direction: -1 | 1) {
    if (!token) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= eventDays.length) return;

    const reordered = [...eventDays];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setEventDays(reordered);

    try {
      await reorderEventDays(
        token,
        eventId,
        reordered.map((d, i) => ({ id: d.id, position: i }))
      );
    } catch (err) {
      setDayError(err instanceof Error ? err.message : "Une erreur est survenue");
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

        {/* ---------- Jours de l'événement (festival multi-jours) ---------- */}
        <div className="bg-[#13131F] border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="text-white text-sm font-semibold mb-1">Jours de l'événement</h2>
          <p className="text-xs text-gray-500 mb-4">
            Facultatif — utile pour un festival ou un événement sur plusieurs jours. Ajoute chaque
            journée pour pouvoir ensuite créer des billets « journée unique », « plusieurs jours »
            ou « pass complet ».
          </p>

          {eventDays.length > 0 && (
            <div className="space-y-2 mb-4">
              {eventDays.map((day, index) => (
                <div
                  key={day.id}
                  className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate">{formatDayLabel(day)}</p>
                    {(day.startTime || day.endTime) && (
                      <p className="text-xs text-gray-500">
                        {day.startTime &&
                          new Date(day.startTime).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        {day.startTime && day.endTime ? " – " : ""}
                        {day.endTime &&
                          new Date(day.endTime).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveDay(index, -1)}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-white disabled:opacity-30 text-xs px-1"
                      title="Monter"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDay(index, 1)}
                      disabled={index === eventDays.length - 1}
                      className="text-gray-400 hover:text-white disabled:opacity-30 text-xs px-1"
                      title="Descendre"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditDay(day)}
                      className="text-purple-400 hover:text-purple-300 text-xs px-2"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDay(day.id)}
                      className="text-red-400 hover:text-red-300 text-xs px-1"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleDaySubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={dayDate}
                  onChange={(e) => setDayDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Libellé — optionnel</label>
                <input
                  type="text"
                  value={dayLabel}
                  onChange={(e) => setDayLabel(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Jour 1 - Ouverture"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Heure de début — optionnel</label>
                <input
                  type="datetime-local"
                  value={dayStartTime}
                  onChange={(e) => setDayStartTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Heure de fin — optionnel</label>
                <input
                  type="datetime-local"
                  value={dayEndTime}
                  onChange={(e) => setDayEndTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {dayError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {dayError}
              </p>
            )}

            <div className="flex gap-3">
              {editingDayId && (
                <button
                  type="button"
                  onClick={resetDayForm}
                  className="flex-1 bg-white/5 border border-white/10 text-white text-sm py-2 rounded-lg hover:bg-white/10 transition"
                >
                  Annuler
                </button>
              )}
              <button
                type="submit"
                disabled={daySubmitting}
                className="flex-1 bg-white/10 border border-white/10 text-white text-sm font-medium py-2 rounded-lg hover:bg-white/15 transition disabled:opacity-50"
              >
                {daySubmitting
                  ? "Enregistrement..."
                  : editingDayId
                    ? "Mettre à jour la journée"
                    : "Ajouter une journée"}
              </button>
            </div>
          </form>
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
                  {accessSummary(ticket) && (
                    <p className="text-xs text-purple-400 mt-1">{accessSummary(ticket)}</p>
                  )}
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

            {hasMultiDaySetup && (
              <div className="border-t border-white/10 pt-4">
                <label className="block text-xs text-gray-400 mb-2">Accès</label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {ACCESS_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setAccessType(option.value)}
                      className={`text-left px-3 py-2 rounded-lg border text-xs transition ${
                        accessType === option.value
                          ? "border-purple-500 bg-purple-500/10 text-white"
                          : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20"
                      }`}
                    >
                      <span className="block font-medium">{option.label}</span>
                      <span className="block text-[11px] text-gray-500 mt-0.5">{option.hint}</span>
                    </button>
                  ))}
                </div>

                {accessType !== "FULL_PASS" && (
                  <div className="flex flex-wrap gap-2">
                    {eventDays.map((day) => {
                      const isSelected = selectedDayIds.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            if (accessType === "SINGLE_DAY") {
                              setSelectedDayIds([day.id]);
                            } else {
                              toggleDaySelection(day.id);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs border transition ${
                            isSelected
                              ? "border-purple-500 bg-purple-500/15 text-white"
                              : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20"
                          }`}
                        >
                          {formatDayLabel(day)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

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