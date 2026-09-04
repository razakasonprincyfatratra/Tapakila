"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { createEvent } from "@/lib/api";
import { MADAGASCAR_REGIONS } from "@/data/madagascarRegions";

const CATEGORIES = ["Musique", "Culture", "Conférence", "Sport", "Loisirs", "Autres"];
const REGIONS = MADAGASCAR_REGIONS.map((r) => r.name);

export default function CreateEventPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [region, setRegion] = useState(REGIONS[0]);
  const [location, setLocation] = useState("");
  const [showGps, setShowGps] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [totalCapacity, setTotalCapacity] = useState("");
  const [conditions, setConditions] = useState("");
  const [refundPolicy, setRefundPolicy] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !token) {
      router.push("/auth");
      return;
    }
    if (user.role !== "ORGANIZER" && user.role !== "ADMIN") {
      router.push("/organizer/apply");
    }
  }, [authLoading, user, token, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) return;

    setSubmitting(true);
    try {
      const { event } = await createEvent(token, {
        title,
        description,
        category,
        region,
        location,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        coverImageUrl: coverImageUrl || undefined,
        videoUrl: videoUrl || undefined,
        totalCapacity: Number(totalCapacity),
        conditions: conditions || undefined,
        refundPolicy: refundPolicy || undefined,
      });

      router.push(`/events/create/${event.id}/tickets`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B0B14] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Chargement...</p>
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
              <div className="w-7 h-7 rounded-full bg-gradient-to-r from-purple-600 to-orange-500 text-white text-xs flex items-center justify-center font-semibold">
                1
              </div>
              <span className="text-white text-sm font-medium">Informations générales</span>
            </div>
            <div className="w-8 h-px bg-white/20" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/10 text-gray-400 text-xs flex items-center justify-center font-semibold">
                2
              </div>
              <span className="text-gray-500 text-sm">Configurer les billets</span>
            </div>
          </div>
        </div>

        <div className="bg-[#13131F] border border-white/10 rounded-2xl p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Titre de l'événement</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Festival Sakalava"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Description</label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                placeholder="Décris l'événement, le programme, les artistes..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Catégorie</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-[#13131F]">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Région</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r} className="bg-[#13131F]">
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Lieu précis</label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Stade Municipal, Diego Suarez"
              />
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowGps((v) => !v)}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                {showGps ? "− Masquer les coordonnées GPS" : "+ Ajouter les coordonnées GPS (pour la carte)"}
              </button>
              {showGps && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="-12.2787"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="49.2917"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Date et heure de début</label>
                <input
                  type="datetime-local"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Date et heure de fin (optionnel)</label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Image de couverture (lien) — optionnel
              </label>
              <input
                type="url"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Vidéo (lien) — optionnel</label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Nombre total de places</label>
              <input
                type="number"
                required
                min={1}
                value={totalCapacity}
                onChange={(e) => setTotalCapacity(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Conditions — optionnel</label>
              <textarea
                rows={2}
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                placeholder="Âge minimum, objets interdits, dress code..."
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Politique de remboursement — optionnel</label>
              <textarea
                rows={2}
                value={refundPolicy}
                onChange={(e) => setRefundPolicy(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                placeholder="Remboursable jusqu'à 48h avant l'événement..."
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
              {submitting ? "Enregistrement..." : "Continuer vers les billets →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}