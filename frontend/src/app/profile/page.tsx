"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import Navbar from "../../components/Navbar";
import { useAuth } from "../../context/AuthContext";
import { fetchProfile, saveProfile, type Profile } from "../../lib/profileApi";

type LoadState = "loading" | "ready" | "error";
type Message = { type: "success" | "error"; text: string } | null;

const PHONE_REGEX = /^\+?[0-9 .\-()]{6,20}$/;

function toDateInput(iso: string | null): string {
  return iso === null ? "" : iso.slice(0, 10);
}

function memberSince(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, loading, updateUser } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [birthDate, setBirthDate] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [photoBroken, setPhotoBroken] = useState(false);

  // Redirection si la session est terminée / absente
  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [loading, user, router]);

  const fillForm = (p: Profile) => {
    setFirstName(p.firstName);
    setLastName(p.lastName);
    setPhone(p.phone ?? "");
    setCity(p.city ?? "");
    setBirthDate(toDateInput(p.birthDate));
  };

  const load = async (authToken: string) => {
    setState("loading");
    try {
      const p = await fetchProfile(authToken);
      setProfile(p);
      fillForm(p);
      setState("ready");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    if (token) void load(token);
  }, [token]);

  const dirty =
    profile !== null &&
    (firstName.trim() !== profile.firstName ||
      lastName.trim() !== profile.lastName ||
      phone.trim() !== (profile.phone ?? "") ||
      city.trim() !== (profile.city ?? "") ||
      birthDate !== toDateInput(profile.birthDate));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !user || !profile) return;
    setMessage(null);

    if (firstName.trim() === "" || lastName.trim() === "") {
      setMessage({ type: "error", text: "Le prénom et le nom sont obligatoires." });
      return;
    }
    if (phone.trim() !== "" && !PHONE_REGEX.test(phone.trim())) {
      setMessage({ type: "error", text: "Le numéro de téléphone n'est pas valide." });
      return;
    }
    if (birthDate !== "" && new Date(birthDate) > new Date()) {
      setMessage({ type: "error", text: "La date de naissance ne peut pas être dans le futur." });
      return;
    }

    setSaving(true);
    try {
      const updated = await saveProfile(token, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() === "" ? null : phone.trim(),
        city: city.trim() === "" ? null : city.trim(),
        birthDate: birthDate === "" ? null : birthDate,
      });
      setProfile(updated);
      fillForm(updated);
      updateUser({ ...user, firstName: updated.firstName, lastName: updated.lastName });
      setMessage({ type: "success", text: "Votre profil a été mis à jour." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Une erreur est survenue." });
    } finally {
      setSaving(false);
    }
  };

  const initials =
    ((profile?.firstName.charAt(0) ?? "") + (profile?.lastName.charAt(0) ?? "")).toUpperCase() ||
    (profile?.email.charAt(0).toUpperCase() ?? "?");

  const inputClass =
    "mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 focus:border-fuchsia-400 focus:outline-none";

  return (
    <div className="min-h-screen bg-[#0b0618] text-white">
      <Navbar />

      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-extrabold">Mon profil</h1>
        <p className="mt-1 text-white/70">Gérez vos informations personnelles.</p>

        {(loading || state === "loading") && (
          <div className="mt-8 space-y-4" aria-busy="true">
            <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
          </div>
        )}

        {!loading && user && state === "error" && (
          <div role="alert" className="mt-8 rounded-2xl border border-red-400/30 bg-red-500/10 p-8 text-center">
            <p className="font-semibold">Impossible de charger votre profil.</p>
            <button
              type="button"
              onClick={() => token && void load(token)}
              className="mt-4 rounded-full bg-violet-600 px-6 py-2 font-semibold hover:bg-violet-500"
            >
              Réessayer
            </button>
          </div>
        )}

        {state === "ready" && profile && (
          <>
            {/* En-tête : avatar + identité */}
            <div className="mt-8 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
              {profile.avatarUrl !== null && !photoBroken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt=""
                  width={72}
                  height={72}
                  onError={() => setPhotoBroken(true)}
                  className="h-[72px] w-[72px] rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-2xl font-bold"
                >
                  {initials}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">
                  {profile.firstName} {profile.lastName}
                </p>
                <p className="truncate text-sm text-white/60">{profile.email}</p>
                <p className="text-xs text-white/50">Membre depuis {memberSince(profile.createdAt)}</p>
              </div>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-5 rounded-2xl border border-white/10 bg-white/5 p-6" noValidate>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm">
                  Prénom
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} required className={inputClass} />
                </label>
                <label className="block text-sm">
                  Nom
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} required className={inputClass} />
                </label>
              </div>

              <label className="block text-sm">
                Adresse e-mail
                <input value={profile.email} readOnly disabled className={`${inputClass} cursor-not-allowed opacity-60`} />
                <span className="mt-1 block text-xs text-white/50">L&apos;adresse e-mail ne peut pas être modifiée pour le moment.</span>
              </label>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm">
                  Téléphone <span className="text-white/40">(facultatif)</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+261 34 00 000 00"
                    maxLength={20}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm">
                  Ville <span className="text-white/40">(facultatif)</span>
                  <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Antananarivo" maxLength={80} className={inputClass} />
                </label>
              </div>

              <label className="block text-sm sm:max-w-xs">
                Date de naissance <span className="text-white/40">(facultatif)</span>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className={`${inputClass} [color-scheme:dark]`}
                />
              </label>

              {message !== null && (
                <p
                  role={message.type === "error" ? "alert" : "status"}
                  className={`rounded-xl px-4 py-3 text-sm ${
                    message.type === "success" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
                  }`}
                >
                  {message.text}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={!dirty || saving}
                  className="rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-2.5 font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? "Enregistrement…" : "Enregistrer les modifications"}
                </button>
                {dirty && !saving && (
                  <button
                    type="button"
                    onClick={() => {
                      fillForm(profile);
                      setMessage(null);
                    }}
                    className="text-sm text-white/70 hover:text-white"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}