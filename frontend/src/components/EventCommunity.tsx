"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import {
  fetchComments,
  fetchReactions,
  postComment,
  removeComment,
  toggleReaction,
  ApiError,
  type EventComment,
  type ReactionSummary,
  type ReactionType,
} from "../lib/communityApi";

const MAX_LENGTH = 1000;

const REACTIONS: { type: ReactionType; label: string; icon: string }[] = [
  { type: "LIKE", label: "J'aime", icon: "👍" },
  { type: "INTERESTED", label: "Intéressé(e)", icon: "⭐" },
];

/* ------------------------------ Utilitaires ------------------------------ */

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Math.round((d.getTime() - Date.now()) / 1000); // négatif = passé
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return "à l'instant";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function Avatar({ firstName, lastName, avatarUrl, size }: { firstName: string; lastName: string; avatarUrl: string | null; size: number }) {
  const [broken, setBroken] = useState(false);
  const dim = { width: size, height: size };
  if (avatarUrl !== null && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" style={dim} onError={() => setBroken(true)} className="shrink-0 rounded-full object-cover" />
    );
  }
  const initials = ((firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || "?");
  return (
    <span
      aria-hidden
      style={{ ...dim, fontSize: size * 0.4 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 font-bold text-white"
    >
      {initials}
    </span>
  );
}

/* -------------------------------- Composant -------------------------------- */

export default function EventCommunity({ eventId }: { eventId: string }) {
  const { user: authUser, token, loading: authLoading } = useAuth();
  // Lecture tolérante : ne dépend pas de la forme exacte du type User
  const user = authUser as unknown as {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
    role?: string;
  } | null;

  // Réactions
  const [reactions, setReactions] = useState<ReactionSummary>({ counts: { LIKE: 0, INTERESTED: 0 }, mine: [] });
  const [pendingReaction, setPendingReaction] = useState<ReactionType | null>(null);
  const [reactionError, setReactionError] = useState<string | null>(null);

  // Commentaires
  const [comments, setComments] = useState<EventComment[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [organizerId, setOrganizerId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "unavailable">("loading");
  const [loadingMore, setLoadingMore] = useState(false);

  // Formulaire
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setState("loading");
    try {
      const page = await fetchComments(eventId);
      setComments(page.comments);
      setTotal(page.total);
      setNextCursor(page.nextCursor);
      setOrganizerId(page.organizerId);
      setState("ready");
    } catch (e) {
      setState(e instanceof ApiError && e.status === 404 ? "unavailable" : "error");
    }
  }, [eventId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  // Les réactions dépendent de la session : on attend qu'elle soit résolue
  useEffect(() => {
    if (authLoading) return;
    fetchReactions(eventId, token)
      .then(setReactions)
      .catch(() => {
        /* les compteurs restent à zéro, sans bloquer la page */
      });
  }, [eventId, token, authLoading]);

  const handleReaction = async (type: ReactionType) => {
    if (!token) return;
    setReactionError(null);
    setPendingReaction(type);
    try {
      setReactions(await toggleReaction(token, eventId, type));
    } catch (e) {
      setReactionError(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setPendingReaction(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const content = draft.trim();
    if (content === "") return;

    setFormError(null);
    setPosting(true);
    try {
      const created = await postComment(token, eventId, content);
      setComments((prev) => [created, ...prev]);
      setTotal((t) => t + 1);
      setDraft("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Publication impossible");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!token) return;
    if (!window.confirm("Supprimer ce commentaire ?")) return;
    setDeletingId(commentId);
    try {
      await removeComment(token, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Suppression impossible");
    } finally {
      setDeletingId(null);
    }
  };

  const loadMore = async () => {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const page = await fetchComments(eventId, nextCursor);
      setComments((prev) => [...prev, ...page.comments]);
      setNextCursor(page.nextCursor);
    } catch {
      setFormError("Impossible de charger plus de commentaires.");
    } finally {
      setLoadingMore(false);
    }
  };

  if (state === "unavailable") return null;

  const canDelete = (c: EventComment): boolean =>
    user !== null && (c.user.id === user.id || organizerId === user.id || user.role === "ADMIN");

  return (
    <section aria-labelledby="community-title" className="mt-10 rounded-3xl border border-white/10 bg-[#150b2b] p-5 text-white sm:p-8">
      {/* ------------------------------ Réactions ------------------------------ */}
      <div className="flex flex-wrap items-center gap-3">
        {REACTIONS.map((r) => {
          const active = reactions.mine.includes(r.type);
          const button = (
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-200"
                  : "border-white/20 hover:bg-white/10"
              }`}
            >
              <span aria-hidden>{r.icon}</span>
              {r.label}
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{reactions.counts[r.type]}</span>
            </span>
          );

          return user ? (
            <button
              key={r.type}
              type="button"
              onClick={() => void handleReaction(r.type)}
              disabled={pendingReaction !== null}
              aria-pressed={active}
              className="disabled:opacity-60"
            >
              {button}
            </button>
          ) : (
            <Link key={r.type} href="/auth" title="Connectez-vous pour réagir">
              {button}
            </Link>
          );
        })}
        {reactionError !== null && (
          <p role="alert" className="text-sm text-red-300">{reactionError}</p>
        )}
      </div>

      {/* ----------------------------- Commentaires ----------------------------- */}
      <h2 id="community-title" className="mt-8 text-xl font-bold">
        Commentaires {state === "ready" && <span className="text-white/50">({total})</span>}
      </h2>

      {/* Formulaire */}
      <div className="mt-4">
        {authLoading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
        ) : user ? (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex gap-3">
            <Avatar firstName={user.firstName} lastName={user.lastName} avatarUrl={user.avatarUrl ?? null} size={40} />
            <div className="min-w-0 flex-1">
              <label htmlFor="comment-input" className="sr-only">Votre commentaire</label>
              <textarea
                id="comment-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={MAX_LENGTH}
                rows={3}
                placeholder="Posez une question ou partagez votre avis…"
                className="w-full resize-y rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-fuchsia-400 focus:outline-none"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-xs text-white/40">{draft.length}/{MAX_LENGTH}</span>
                <button
                  type="submit"
                  disabled={posting || draft.trim() === ""}
                  className="rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {posting ? "Publication…" : "Publier"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <p className="rounded-2xl bg-white/5 p-4 text-sm text-white/75">
            <Link href="/auth" className="font-semibold text-fuchsia-300 hover:underline">Connectez-vous</Link>{" "}
            pour commenter et réagir à cet événement.
          </p>
        )}
        {formError !== null && (
          <p role="alert" className="mt-2 rounded-xl bg-red-500/15 px-4 py-2 text-sm text-red-300">{formError}</p>
        )}
      </div>

      {/* Liste */}
      <div className="mt-6">
        {state === "loading" && (
          <div className="space-y-3" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        )}

        {state === "error" && (
          <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-center">
            <p className="font-semibold">Impossible de charger les commentaires.</p>
            <button
              type="button"
              onClick={() => void loadComments()}
              className="mt-3 rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold hover:bg-violet-500"
            >
              Réessayer
            </button>
          </div>
        )}

        {state === "ready" && comments.length === 0 && (
          <p className="rounded-2xl bg-white/5 p-6 text-center text-sm text-white/65">
            Aucun commentaire pour le moment. Soyez le premier à vous exprimer !
          </p>
        )}

        {state === "ready" && comments.length > 0 && (
          <ul className="space-y-4">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-3">
                <Avatar firstName={c.user.firstName} lastName={c.user.lastName} avatarUrl={c.user.avatarUrl} size={40} />
                <div className="min-w-0 flex-1 rounded-2xl bg-white/5 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="font-semibold">{c.user.firstName} {c.user.lastName}</span>
                    {organizerId === c.user.id && (
                      <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-200">
                        Organisateur
                      </span>
                    )}
                    <span className="text-xs text-white/45">{timeAgo(c.createdAt)}</span>
                    {canDelete(c) && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(c.id)}
                        disabled={deletingId === c.id}
                        className="ml-auto text-xs text-red-300 hover:underline disabled:opacity-50"
                      >
                        {deletingId === c.id ? "Suppression…" : "Supprimer"}
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/85">{c.content}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {state === "ready" && nextCursor !== null && (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="rounded-full border border-white/30 px-5 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
            >
              {loadingMore ? "Chargement…" : "Voir plus de commentaires"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}