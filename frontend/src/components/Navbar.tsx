"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

/* -------------------------------------------------------------------------- */
/*  Entrées du menu                                                           */
/*  ready: false => affichée grisée avec « Bientôt » (évite les pages 404).   */
/*  Passez ready à true dès que la page correspondante existe.                */
/* -------------------------------------------------------------------------- */

type MenuItem = { label: string; href: string; icon: string; ready: boolean };

const CLIENT_ITEMS: MenuItem[] = [
  { label: "Mon profil", href: "/profile", icon: "👤", ready: true },
  { label: "Mes billets", href: "/tickets", icon: "🎫", ready: false },
  { label: "Mes réservations", href: "/reservations", icon: "🧾", ready: false },
  { label: "Mes favoris", href: "/favorites", icon: "❤️", ready: false },
];

const ORGANIZER_ITEMS: MenuItem[] = [
  { label: "Mes événements", href: "/events/mine", icon: "📅", ready: true },
  { label: "Créer un événement", href: "/events/create", icon: "➕", ready: true },
];

const SETTINGS_ITEM: MenuItem = { label: "Paramètres", href: "/settings", icon: "⚙️", ready: false };

const NAV_LINKS = [
  { href: "/#evenements", label: "Événements" },
  { href: "/#categories", label: "Catégories" },
  { href: "/#organisateurs", label: "Organisateurs" },
  { href: "/#faq", label: "FAQ" },
];

/* -------------------------------------------------------------------------- */
/*  Lecture défensive de l'utilisateur (le type User peut évoluer)            */
/* -------------------------------------------------------------------------- */

function readString(r: Record<string, unknown>, key: string): string | null {
  const v = r[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function readUser(u: unknown) {
  const r: Record<string, unknown> =
    typeof u === "object" && u !== null ? (u as Record<string, unknown>) : {};

  const firstName = readString(r, "firstName");
  const lastName = readString(r, "lastName");
  const email = readString(r, "email");
  const photoUrl =
    readString(r, "avatarUrl") ?? readString(r, "photoUrl") ?? readString(r, "profileImage") ?? readString(r, "image");

  const roles: string[] = [];
  const role = readString(r, "role");
  if (role !== null) roles.push(role.toUpperCase());
  const rolesArr = r["roles"];
  if (Array.isArray(rolesArr)) {
    for (const x of rolesArr) if (typeof x === "string") roles.push(x.toUpperCase());
  }

  const fullName = [firstName, lastName].filter((x): x is string => x !== null).join(" ");
  const initials =
    ((firstName?.charAt(0) ?? "") + (lastName?.charAt(0) ?? "")).toUpperCase() ||
    (email?.charAt(0).toUpperCase() ?? "?");

  return {
    name: fullName !== "" ? fullName : (email ?? "Utilisateur"),
    email,
    photoUrl,
    initials,
    isOrganizer: roles.includes("ORGANIZER"),
  };
}

/* -------------------------------------------------------------------------- */
/*  Avatar                                                                    */
/* -------------------------------------------------------------------------- */

function Avatar({ photoUrl, initials, size }: { photoUrl: string | null; initials: string; size: number }) {
  const [broken, setBroken] = useState(false);
  const dim = { width: size, height: size };

  if (photoUrl !== null && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        style={dim}
        onError={() => setBroken(true)}
        className="rounded-full object-cover"
      />
    );
  }
  return (
    <span
      style={{ ...dim, fontSize: size * 0.4 }}
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 font-bold text-white"
      aria-hidden
    >
      {initials}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Navbar                                                                    */
/* -------------------------------------------------------------------------- */

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Fermeture du menu : clic extérieur + touche Échap
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const info = user ? readUser(user) : null;

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    router.push("/");
  };

  const renderItem = (item: MenuItem) =>
    item.ready ? (
      <Link
        key={item.label}
        href={item.href}
        onClick={() => setMenuOpen(false)}
        role="menuitem"
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-white/10"
      >
        <span aria-hidden>{item.icon}</span>
        {item.label}
      </Link>
    ) : (
      <span
        key={item.label}
        role="menuitem"
        aria-disabled="true"
        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/40"
      >
        <span aria-hidden className="opacity-60">{item.icon}</span>
        {item.label}
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">Bientôt</span>
      </span>
    );

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0618]/85 text-white backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-xl font-extrabold tracking-tight">
          <span className="text-fuchsia-400">Tapa</span>kila
        </Link>

        <ul className="hidden items-center gap-6 text-sm text-white/80 md:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="hover:text-white">{l.label}</Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          {/* --- Zone d'authentification, pilotée par la session réelle --- */}
          {loading ? (
            <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" aria-label="Chargement de la session" />
          ) : info === null ? (
            <>
              <Link href="/auth" className="hidden rounded-full border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10 sm:inline-flex">
                S&apos;inscrire
              </Link>
              <Link href="/auth" className="rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2 text-sm font-semibold hover:opacity-90">
                Se connecter
              </Link>
            </>
          ) : (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Ouvrir le menu du compte"
                className="rounded-full ring-2 ring-transparent transition hover:ring-fuchsia-400/60 focus:outline-none focus-visible:ring-fuchsia-300"
              >
                <Avatar photoUrl={info.photoUrl} initials={info.initials} size={40} />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-3 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#150b2b] shadow-2xl shadow-black/50"
                >
                  {/* En-tête : avatar, nom, e-mail, statut */}
                  <div className="flex items-center gap-3 border-b border-white/10 p-4">
                    <Avatar photoUrl={info.photoUrl} initials={info.initials} size={48} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{info.name}</p>
                      {info.email !== null && <p className="truncate text-xs text-white/60">{info.email}</p>}
                      <p className="mt-0.5 text-xs text-emerald-400">● Compte connecté</p>
                    </div>
                  </div>

                  {/* Espace client */}
                  <div className="p-2">{CLIENT_ITEMS.map(renderItem)}</div>

                  {/* Espace organisateur (si autorisé) */}
                  {info.isOrganizer && (
                    <div className="border-t border-white/10 p-2">
                      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-fuchsia-300">
                        Espace organisateur
                      </p>
                      {ORGANIZER_ITEMS.map(renderItem)}
                    </div>
                  )}

                  {/* Paramètres + déconnexion */}
                  <div className="border-t border-white/10 p-2">
                    {renderItem(SETTINGS_ITEM)}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
                    >
                      <span aria-hidden>🚪</span>
                      Se déconnecter
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            aria-label="Ouvrir la navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm md:hidden"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="space-y-1 border-t border-white/10 px-4 py-3 text-sm md:hidden">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-white/10">
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}