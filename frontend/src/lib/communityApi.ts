const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://tapakila.onrender.com";

export type ReactionType = "LIKE" | "INTERESTED";

export type CommentUser = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export type EventComment = {
  id: string;
  content: string;
  createdAt: string;
  user: CommentUser;
};

export type CommentsPage = {
  comments: EventComment[];
  total: number;
  nextCursor: string | null;
  organizerId: string;
};

export type ReactionSummary = {
  counts: Record<ReactionType, number>;
  mine: ReactionType[];
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;

  if (!res.ok || json === null) {
    throw new ApiError((json as { error?: string } | null)?.error ?? "Une erreur est survenue", res.status);
  }
  return json;
}

export function fetchComments(eventId: string, cursor?: string | null): Promise<CommentsPage> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return call<CommentsPage>(`/api/events/${eventId}/comments${qs}`, { cache: "no-store" });
}

export async function postComment(token: string, eventId: string, content: string): Promise<EventComment> {
  const r = await call<{ comment: EventComment }>(
    `/api/events/${eventId}/comments`,
    { method: "POST", body: JSON.stringify({ content }) },
    token,
  );
  return r.comment;
}

export async function removeComment(token: string, commentId: string): Promise<void> {
  await call<{ success: boolean }>(`/api/comments/${commentId}`, { method: "DELETE" }, token);
}

export function fetchReactions(eventId: string, token?: string | null): Promise<ReactionSummary> {
  return call<ReactionSummary>(`/api/events/${eventId}/reactions`, { cache: "no-store" }, token);
}

export function toggleReaction(token: string, eventId: string, type: ReactionType): Promise<ReactionSummary> {
  return call<ReactionSummary>(
    `/api/events/${eventId}/reactions`,
    { method: "POST", body: JSON.stringify({ type }) },
    token,
  );
}