"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";

/* -------------------------------------------------------------------------- */
/*  Configuration                                                             */
/* -------------------------------------------------------------------------- */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://tapakila.onrender.com";
const EVENTS_ENDPOINT = `${API_URL}/api/events`; // adapter si votre route publique est différente

const CATEGORIES = [
  { label: "Musique", icon: "🎵", gradient: "from-fuchsia-600 to-purple-900" },
  { label: "Culture", icon: "🎭", gradient: "from-amber-500 to-rose-800" },
  { label: "Conférence", icon: "🎤", gradient: "from-sky-600 to-indigo-900" },
  { label: "Sport", icon: "⚽", gradient: "from-emerald-500 to-teal-900" },
  { label: "Loisirs", icon: "🎪", gradient: "from-pink-500 to-purple-800" },
  { label: "Autres", icon: "✨", gradient: "from-violet-500 to-slate-900" },
] as const;

const FAQ = [
  {
    q: "Comment acheter un billet sur Tapakila ?",
    a: "Choisissez un événement, sélectionnez votre type de billet et la quantité, puis suivez les étapes de réservation et de paiement.",
  },
  {
    q: "Comment retrouver mon billet ?",
    a: "Vos billets sont disponibles dans la rubrique « Mes billets » de votre compte, une fois la réservation confirmée.",
  },
  {
    q: "Comment fonctionne le QR code à l'entrée ?",
    a: "Chaque billet possède un QR code unique. Il est scanné à l'entrée de l'événement et n'est valable qu'une seule fois.",
  },
  {
    q: "Comment devenir organisateur ?",
    a: "Créez un compte, puis déposez votre demande depuis la page « Devenir organisateur ». Elle est examinée avant validation.",
  },
] as const;

/* -------------------------------------------------------------------------- */
/*  Types & normalisation des données                                         */
/* -------------------------------------------------------------------------- */

type EventItem = {
  id: string;
  title: string;
  category: string | null;
  date: string | null;
  location: string | null;
  imageUrl: string | null;
  minPrice: number | null;
};

type LoadState = "loading" | "ready" | "error";

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

function normalizeEvent(raw: unknown): EventItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const rawId = r["id"];
  const id = typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : null;
  const title = str(r["title"]) ?? str(r["name"]);
  if (id === null || title === null) return null;

  // Garde-fou : ne jamais afficher brouillons / en attente / annulés
  const status = str(r["status"]);
  if (status !== null && ["DRAFT", "PENDING", "REJECTED", "CANCELLED"].includes(status.toUpperCase())) {
    return null;
  }

  let minPrice: number | null = null;
  const ticketTypes = r["ticketTypes"];
  if (Array.isArray(ticketTypes)) {
    const prices = ticketTypes
      .map((t) => (typeof t === "object" && t !== null ? (t as Record<string, unknown>)["price"] : null))
      .filter((p): p is number => typeof p === "number");
    if (prices.length > 0) minPrice = Math.min(...prices);
  }

  return {
    id,
    title,
    category: str(r["category"]),
    date: str(r["startDate"]) ?? str(r["date"]),
    location: str(r["location"]) ?? str(r["venue"]) ?? str(r["city"]),
    imageUrl: str(r["coverImageUrl"]) ?? str(r["imageUrl"]) ?? str(r["image"]),
    minPrice,
  };
}

function extractEvents(json: unknown): EventItem[] {
  let list: unknown[] = [];
  if (Array.isArray(json)) {
    list = json;
  } else if (typeof json === "object" && json !== null) {
    const o = json as Record<string, unknown>;
    const candidate = o["events"] ?? o["data"];
    if (Array.isArray(candidate)) list = candidate;
  }
  return list.map(normalizeEvent).filter((e): e is EventItem => e !== null);
}

function formatDate(iso: string | null): string | null {
  if (iso === null) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatPrice(p: number | null): string | null {
  if (p === null) return null;
  return p === 0 ? "Gratuit" : `Dès ${p.toLocaleString("fr-FR")} Ar`;
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("Tous");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const loadEvents = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch(EVENTS_ENDPOINT, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEvents(extractEvents(await res.json()));
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      const matchCat = category === "Tous" || e.category?.toLowerCase() === category.toLowerCase();
      const matchQuery =
        q === "" ||
        e.title.toLowerCase().includes(q) ||
        (e.location?.toLowerCase().includes(q) ?? false);
      return matchCat && matchQuery;
    });
  }, [events, query, category]);

  const goToEvents = () => {
    document.getElementById("evenements")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#0b0618] text-white">
      <Navbar />

      {/* --------------------------------- Hero --------------------------------- */}
      <section className="relative overflow-hidden">
        <Image
          src="/images/im.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Voile sombre pour garder le texte lisible */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#0b0618]/90 via-[#0b0618]/60 to-[#0b0618]/20" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0b0618] to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-28">
          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight md:text-6xl">
            Toutes vos expériences commencent <span className="text-fuchsia-400">ici.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/80 md:text-lg">
            Découvrez, réservez et vivez les meilleurs événements à Madagascar avec Tapakila.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              goToEvents();
            }}
            className="mt-8 flex max-w-2xl flex-col gap-3 rounded-3xl bg-white/10 p-3 backdrop-blur sm:flex-row sm:items-center sm:rounded-full"
          >
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un événement ou un lieu…"
              aria-label="Rechercher un événement"
              className="flex-1 rounded-full bg-transparent px-4 py-2 text-white placeholder:text-white/50 focus:outline-none"
            />
            <button type="submit" className="rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-2.5 font-semibold hover:opacity-90">
              Rechercher
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={goToEvents} className="rounded-full bg-violet-600 px-6 py-3 font-semibold hover:bg-violet-500">
              Découvrir les événements →
            </button>
            <Link href="/events/create" className="rounded-full border border-white/40 px-6 py-3 text-center font-semibold hover:bg-white/10">
              Organiser un événement
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------ Catégories ------------------------------ */}
      <section id="categories" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold">Catégories populaires</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((c) => {
            const active = category === c.label;
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => {
                  setCategory(active ? "Tous" : c.label);
                  goToEvents();
                }}
                aria-pressed={active}
                className={`flex aspect-[4/5] flex-col items-center justify-end rounded-2xl bg-gradient-to-br ${c.gradient} p-4 text-center transition hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 ${active ? "ring-2 ring-fuchsia-300" : ""}`}
              >
                <span className="text-4xl" aria-hidden>{c.icon}</span>
                <span className="mt-3 text-sm font-semibold">{c.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ------------------------------ Événements ------------------------------ */}
      <section id="evenements" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-bold">Événements à découvrir</h2>
          {category !== "Tous" && (
            <button type="button" onClick={() => setCategory("Tous")} className="text-sm text-fuchsia-300 hover:underline">
              Catégorie : {category} ✕
            </button>
          )}
        </div>

        <div className="mt-6">
          {state === "loading" && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-72 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          )}

          {state === "error" && (
            <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 p-8 text-center">
              <p className="font-semibold">Impossible de charger les événements.</p>
              <p className="mt-1 text-sm text-white/70">Vérifiez votre connexion puis réessayez.</p>
              <button type="button" onClick={() => void loadEvents()} className="mt-4 rounded-full bg-violet-600 px-6 py-2 font-semibold hover:bg-violet-500">
                Réessayer
              </button>
            </div>
          )}

          {state === "ready" && events.length === 0 && (
            <div className="rounded-3xl bg-gradient-to-r from-violet-200/10 to-fuchsia-300/10 p-10 text-center">
              <div className="text-5xl" aria-hidden>🎟️</div>
              <h3 className="mt-4 text-2xl font-bold">Les prochains événements arrivent bientôt !</h3>
              <p className="mx-auto mt-2 max-w-md text-white/75">
                Notre communauté d&apos;organisateurs prépare de nouvelles expériences. Revenez bientôt pour découvrir les prochains rendez-vous.
              </p>
              <Link href="/events/create" className="mt-6 inline-block rounded-full border border-white/40 px-6 py-2.5 text-sm font-semibold hover:bg-white/10">
                Vous organisez un événement ? Publiez-le ici
              </Link>
            </div>
          )}

          {state === "ready" && events.length > 0 && filtered.length === 0 && (
            <p className="rounded-2xl bg-white/5 p-8 text-center text-white/75">
              Aucun événement ne correspond à votre recherche.
            </p>
          )}

          {state === "ready" && filtered.length > 0 && (
            <div
              className={
                filtered.length === 1
                  ? "mx-auto max-w-md"
                  : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
              }
            >
              {filtered.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* --------------------------- Pourquoi Tapakila --------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold">Pourquoi choisir Tapakila ?</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["🎫", "Réservation simplifiée", "Réservez vos billets en quelques clics."],
            ["🛡️", "Billets sécurisés", "Chaque billet possède un QR code unique, validé une seule fois."],
            ["📱", "Billets numériques", "Retrouvez vos billets dans votre espace, sur votre téléphone."],
            ["👥", "Pour les organisateurs", "Créez, gérez et suivez vos événements et vos ventes."],
          ].map(([icon, title, text]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-3xl" aria-hidden>{icon}</div>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-white/70">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------- Organisateurs ----------------------------- */}
      <section id="organisateurs" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-gradient-to-r from-violet-700 to-fuchsia-700 p-8 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold">Vous organisez un événement ?</h2>
            <p className="mt-1 text-lg text-white/90">Faites-le connaître avec Tapakila.</p>
            <ul className="mt-4 space-y-1 text-sm text-white/90">
              <li>✔ Publiez vos événements facilement</li>
              <li>✔ Gérez vos billets et vos quotas</li>
              <li>✔ Suivez vos réservations et vos ventes</li>
            </ul>
          </div>
          <Link href="/events/create" className="rounded-full bg-white px-6 py-3 font-semibold text-violet-800 hover:bg-white/90">
            Devenir organisateur →
          </Link>
        </div>
      </section>

      {/* ----------------------------- Comment ça marche ----------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold">Comment ça marche ?</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Découvrez", "Trouvez un événement qui vous intéresse."],
            ["Réservez", "Choisissez votre billet et effectuez votre réservation."],
            ["Profitez", "Présentez votre billet à l'entrée."],
          ].map(([title, text], i) => (
            <li key={title} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 font-bold">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-white/70">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------- FAQ ---------------------------------- */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-12">
        <h2 className="text-2xl font-bold">FAQ</h2>
        <div className="mt-6 space-y-3">
          {FAQ.map((item, i) => {
            const open = openFaq === i;
            return (
              <div key={item.q} className="rounded-xl border border-white/10 bg-white/5">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium"
                >
                  {item.q}
                  <span aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
                </button>
                {open && <p className="px-5 pb-4 text-sm text-white/75">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* -------------------------------- Footer -------------------------------- */}
      <footer className="border-t border-white/10 px-4 py-8 text-center text-sm text-white/60">
        <p className="font-semibold text-white">
          <span className="text-fuchsia-400">Tapa</span>kila
        </p>
        <p className="mt-1">Vivez plus. Avec Tapakila !</p>
        <p className="mt-4">© {new Date().getFullYear()} Tapakila. Tous droits réservés.</p>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Carte événement                                                           */
/* -------------------------------------------------------------------------- */

function EventCard({ event }: { event: EventItem }) {
  const date = formatDate(event.date);
  const price = formatPrice(event.minPrice);

  return (
    <Link
      href={`/events/${event.id}`}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:-translate-y-1 hover:border-fuchsia-400/50"
    >
      <div className="relative aspect-[16/10] bg-gradient-to-br from-violet-700 to-fuchsia-800">
        {event.imageUrl !== null ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.imageUrl}
            alt={event.title}
            width={640}
            height={400}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl" aria-hidden>🎟️</div>
        )}
        {event.category !== null && (
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium">
            {event.category}
          </span>
        )}
      </div>
      <div className="space-y-1 p-4">
        <h3 className="line-clamp-2 font-semibold group-hover:text-fuchsia-300">{event.title}</h3>
        {date !== null && <p className="text-sm text-white/70">📅 {date}</p>}
        {event.location !== null && <p className="text-sm text-white/70">📍 {event.location}</p>}
        {price !== null && <p className="pt-1 text-sm font-semibold text-fuchsia-300">{price}</p>}
      </div>
    </Link>
  );
}