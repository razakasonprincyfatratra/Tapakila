"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";
import { listEvents, fetchRegionStats, type Event, type RegionStat } from "@/lib/api";

// react-simple-maps calcule les transformations des <Marker> avec des
// opérations en virgule flottante (projection geoMercator) qui peuvent
// arrondir différemment côté serveur (Node) et côté client (navigateur).
// Cela déclenche une erreur d'hydratation même si le rendu final est
// identique visuellement. On désactive donc le SSR pour ce composant.
const MadagascarMap = dynamic(() => import("@/components/MadagascarMap"), {
  ssr: false,
  loading: () => <MadagascarMapSkeleton />,
});

const CATEGORIES = ["Tous", "Musique", "Culture", "Conférence", "Sport", "Loisirs", "Autres"];

export default function HomePage() {
  const { user, logout } = useAuth();

  const [events, setEvents] = useState<Event[]>([]);
  const [regionStats, setRegionStats] = useState<RegionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tous");
  const [region, setRegion] = useState<string | null>(null);

  useEffect(() => {
    fetchRegionStats()
      .then((res) => setRegionStats(res.stats))
      .catch(() => setRegionStats([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    listEvents({
      search: search || undefined,
      category: category !== "Tous" ? category : undefined,
      region: region ?? undefined,
    })
      .then((res) => setEvents(res.events))
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur de chargement"))
      .finally(() => setLoading(false));
  }, [search, category, region]);

  return (
    <div className="min-h-screen bg-[#0B0B14]">
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent">
              TAPAKILA
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                {(user.role === "ORGANIZER" || user.role === "ADMIN") && (
                  <Link
                    href="/events/create"
                    className="text-sm text-white bg-white/10 border border-white/10 px-4 py-2 rounded-lg hover:bg-white/15 transition"
                  >
                    Créer un événement
                  </Link>
                )}
                {user.role === "PARTICIPANT" && (
                  <Link href="/organizer/apply" className="text-sm text-gray-400 hover:text-white transition">
                    Devenir organisateur
                  </Link>
                )}
                <Link href="/tickets" className="text-sm text-gray-400 hover:text-white transition">
                  Mes billets
                </Link>
                <span className="text-sm text-gray-400 hidden sm:inline">{user.firstName}</span>
                <button onClick={logout} className="text-sm text-gray-400 hover:text-white transition">
                  Déconnexion
                </button>
              </>
            ) : (
              <Link
                href="/auth"
                className="text-sm text-white bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 px-4 py-2 rounded-lg hover:opacity-90 transition"
              >
                Se connecter
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-12 grid lg:grid-cols-[1fr_280px] gap-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Vivez des moments{" "}
            <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent">
              inoubliables
            </span>
          </h1>
          <p className="text-gray-400 mb-6">
            Découvrez et réservez vos billets pour les meilleurs événements à Madagascar.
          </p>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un événement, un artiste, un lieu..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-6"
          />

          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`text-sm px-4 py-1.5 rounded-full border transition ${
                  category === c
                    ? "bg-gradient-to-r from-purple-600 to-orange-500 border-transparent text-white"
                    : "border-white/10 text-gray-400 hover:text-white hover:border-white/20"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {region && (
            <div className="flex items-center gap-2 mb-6">
              <span className="text-xs text-gray-500">Région :</span>
              <span className="text-xs bg-white/10 text-white px-3 py-1 rounded-full flex items-center gap-2">
                {region}
                <button onClick={() => setRegion(null)} className="text-gray-400 hover:text-white">
                  ×
                </button>
              </span>
            </div>
          )}

          {loading && <p className="text-gray-500 text-sm">Chargement des événements...</p>}

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 max-w-xl">
              {error}
            </p>
          )}

          {!loading && !error && events.length === 0 && (
            <p className="text-gray-500 text-sm">Aucun événement trouvé pour le moment.</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>

        <aside>
          <MadagascarMap stats={regionStats} selectedRegion={region} onSelectRegion={setRegion} />
        </aside>
      </section>
    </div>
  );
}

function MadagascarMapSkeleton() {
  return (
    <div className="bg-[#13131F] border border-white/10 rounded-2xl p-5 animate-pulse">
      <div className="h-4 w-40 bg-white/10 rounded mb-1" />
      <div className="h-3 w-56 bg-white/5 rounded mb-4" />
      <div className="h-[480px] bg-black/20 rounded-xl" />
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-4 bg-white/5 rounded" />
        ))}
      </div>
    </div>
  );
}

function EventCard({ event }: { event: Event }) {
  const minPrice =
    event.ticketTypes && event.ticketTypes.length > 0
      ? Math.min(...event.ticketTypes.map((t) => Number(t.price)))
      : null;

  const dateLabel = new Date(event.startDate).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Link
      href={`/events/${event.id}`}
      className="group bg-[#13131F] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition"
    >
      <div className="h-40 bg-gradient-to-br from-purple-900/40 via-pink-900/30 to-orange-900/40 relative">
        {event.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverImageUrl} alt={event.title} className="w-full h-full object-cover" />
        ) : null}
        <span className="absolute top-3 left-3 text-xs bg-black/60 text-white px-2 py-1 rounded-full">
          {event.category}
        </span>
      </div>
      <div className="p-4">
        <h3 className="text-white font-semibold text-sm mb-1 group-hover:text-purple-400 transition">
          {event.title}
        </h3>
        <p className="text-xs text-gray-500 mb-1">{dateLabel}</p>
        <p className="text-xs text-gray-500 mb-3">{event.location}</p>
        <p className="text-sm text-white font-medium">
          {minPrice !== null ? `À partir de ${minPrice.toLocaleString("fr-FR")} Ar` : "Billets bientôt disponibles"}
        </p>
      </div>
    </Link>
  );
}