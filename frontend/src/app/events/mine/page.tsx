"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { listMyEvents, type Event } from "@/lib/api";

const STATUS_STYLES: Record<Event["status"], string> = {
  DRAFT: "bg-white/10 text-gray-400",
  PUBLISHED: "bg-green-500/15 text-green-400",
  CANCELLED: "bg-red-500/15 text-red-400",
  COMPLETED: "bg-blue-500/15 text-blue-400",
};

const STATUS_LABELS: Record<Event["status"], string> = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publié",
  CANCELLED: "Annulé",
  COMPLETED: "Terminé",
};

export default function MyEventsPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !token) {
      router.push("/auth");
      return;
    }

    listMyEvents(token)
      .then((res) => setEvents(res.events))
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger tes événements"))
      .finally(() => setLoading(false));
  }, [authLoading, user, token, router]);

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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Mes événements</h1>
          <Link
            href="/events/create"
            className="text-sm text-white bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 px-4 py-2 rounded-lg hover:opacity-90 transition"
          >
            + Créer un événement
          </Link>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
            {error}
          </p>
        )}

        {events.length === 0 && !error && (
          <p className="text-gray-500 text-sm">
            Tu n'as pas encore créé d'événement.{" "}
            <Link href="/events/create" className="text-purple-400 hover:text-purple-300">
              Créer le premier →
            </Link>
          </p>
        )}

        <div className="space-y-4">
          {events.map((event) => {
            const dateLabel = new Date(event.startDate).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });

            return (
              <div key={event.id} className="bg-[#13131F] border border-white/10 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-white font-semibold text-sm">{event.title}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[event.status]}`}>
                        {STATUS_LABELS[event.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {dateLabel} · {event.location}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {event.totalCapacity.toLocaleString("fr-FR")} places · {event.category}
                    </p>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Link
                      href={`/events/create/${event.id}/tickets`}
                      className="text-xs text-white bg-white/10 border border-white/10 px-3 py-2 rounded-lg hover:bg-white/15 transition"
                    >
                      Gérer les billets
                    </Link>
                    {event.status === "PUBLISHED" && (
                      <Link
                        href={`/events/${event.id}`}
                        className="text-xs text-gray-400 hover:text-white transition self-center"
                      >
                        Voir la page publique
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}