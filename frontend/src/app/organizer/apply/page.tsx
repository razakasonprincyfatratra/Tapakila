"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../context/AuthContext";
import {
  applyAsOrganizer,
  fetchMyOrganizerApplication,
  type OrganizerApplication,
} from "../../../lib/api";

export default function BecomeOrganizerPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();

  const [checkingApplication, setCheckingApplication] = useState(true);
  const [existingApplication, setExistingApplication] = useState<OrganizerApplication | null>(null);

  const [organizationName, setOrganizationName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [idDocumentUrl, setIdDocumentUrl] = useState("");
  const [businessRegistryUrl, setBusinessRegistryUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user || !token) {
      router.push("/auth");
      return;
    }

    setEmail(user.email);

    fetchMyOrganizerApplication(token)
      .then(({ application }) => setExistingApplication(application))
      .catch(() => setExistingApplication(null))
      .finally(() => setCheckingApplication(false));
  }, [authLoading, user, token, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) return;

    setSubmitting(true);
    try {
      await applyAsOrganizer(token, {
        organizationName,
        phone,
        email,
        description,
        idDocumentUrl,
        businessRegistryUrl: businessRegistryUrl || undefined,
        logoUrl: logoUrl || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || checkingApplication) {
    return (
      <div className="min-h-screen bg-[#0B0B14] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Chargement...</p>
      </div>
    );
  }

  if (user?.role === "ORGANIZER" || user?.role === "ADMIN") {
    return (
      <StatusScreen
        title="Tu es déjà organisateur"
        message="Ton compte a déjà les droits organisateur. Tu peux créer un événement dès maintenant."
        actionLabel="Créer un événement"
        actionHref="/events/create"
      />
    );
  }

  if (submitted || existingApplication?.status === "PENDING") {
    return (
      <StatusScreen
        title="Demande envoyée"
        message="Ta demande est en cours d'examen par notre équipe. Tu recevras une notification dès qu'elle sera traitée."
        actionLabel="Retour à l'accueil"
        actionHref="/"
      />
    );
  }

  if (existingApplication?.status === "REJECTED") {
    return (
      <div className="min-h-screen bg-[#0B0B14] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-[#13131F] border border-red-500/20 rounded-2xl p-8 text-center">
            <h1 className="text-xl font-semibold text-white mb-2">Demande refusée</h1>
            <p className="text-gray-400 text-sm mb-4">
              {existingApplication.rejectionReason ||
                "Ta précédente demande n'a pas été retenue."}
            </p>
            <button
              onClick={() => setExistingApplication(null)}
              className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition"
            >
              Soumettre une nouvelle demande
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B14] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block text-3xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent">
              TAPAKILA
            </span>
          </Link>
          <h1 className="text-white text-xl font-semibold mt-4">Devenir organisateur</h1>
          <p className="text-gray-400 text-sm mt-2">
            Remplis ce formulaire pour créer et gérer tes propres événements sur Tapakila.
          </p>
        </div>

        <div className="bg-[#13131F] border border-white/10 rounded-2xl p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Nom de l'organisation ou de l'entreprise
              </label>
              <input
                type="text"
                required
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Gestion Events Madagascar"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Téléphone</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="034 00 000 00"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email professionnel</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="contact@organisation.mg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Description de l'activité</label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                placeholder="Décris brièvement ton activité et le type d'événements que tu comptes organiser."
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                CIN ou pièce d'identité (lien vers le document)
              </label>
              <input
                type="url"
                required
                value={idDocumentUrl}
                onChange={(e) => setIdDocumentUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="https://..."
              />
              <p className="text-xs text-gray-500 mt-1">
                L'upload direct de fichier sera bientôt disponible. Pour l'instant, héberge ton
                document et colle le lien ici.
              </p>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Registre de commerce (optionnel)
              </label>
              <input
                type="url"
                value={businessRegistryUrl}
                onChange={(e) => setBusinessRegistryUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Logo (optionnel)</label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="https://..."
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {submitting ? "Envoi en cours..." : "Envoyer ma demande"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function StatusScreen({
  title,
  message,
  actionLabel,
  actionHref,
}: {
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="min-h-screen bg-[#0B0B14] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-[#13131F] border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold text-white mb-2">{title}</h1>
          <p className="text-gray-400 text-sm mb-6">{message}</p>
          <Link
            href={actionHref}
            className="inline-block w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition"
          >
            {actionLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}