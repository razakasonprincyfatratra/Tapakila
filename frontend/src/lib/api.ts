const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl: string | null;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface OrganizerApplication {
  id: string;
  userId: string;
  organizationName: string;
  phone: string;
  email: string;
  description: string;
  idDocumentUrl: string;
  businessRegistryUrl: string | null;
  logoUrl: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  price: string;
  totalSeats: number;
  availableSeats: number;
  seatMapZone: string | null;
  salesStart: string | null;
  salesEnd: string | null;
  isActive: boolean;
  order: number;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  category: string;
  region: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  startDate: string;
  endDate: string | null;
  coverImageUrl: string | null;
  images: string[];
  videoUrl: string | null;
  totalCapacity: number;
  conditions: string | null;
  refundPolicy: string | null;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";
  organizerId: string;
  createdAt: string;
  updatedAt: string;
  ticketTypes?: TicketType[];
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Une erreur est survenue");
  }
  return data as T;
}

function authHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ---------- Auth ----------

export async function registerUser(payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<AuthResponse>(res);
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<AuthResponse>(res);
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  return handleResponse<AuthResponse>(res);
}

export async function loginWithFacebook(accessToken: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/facebook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  return handleResponse<AuthResponse>(res);
}

export async function fetchMe(token: string): Promise<{ user: User }> {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ user: User }>(res);
}

// ---------- Organizer application ----------

export async function applyAsOrganizer(
  token: string,
  payload: {
    organizationName: string;
    phone: string;
    email: string;
    description: string;
    idDocumentUrl: string;
    businessRegistryUrl?: string;
    logoUrl?: string;
  }
): Promise<{ application: OrganizerApplication }> {
  const res = await fetch(`${API_URL}/api/organizer/apply`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<{ application: OrganizerApplication }>(res);
}

export async function fetchMyOrganizerApplication(
  token: string
): Promise<{ application: OrganizerApplication | null }> {
  const res = await fetch(`${API_URL}/api/organizer/applications/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ application: OrganizerApplication | null }>(res);
}

// ---------- Events ----------

export interface CreateEventPayload {
  title: string;
  description: string;
  category: string;
  region: string;
  location: string;
  latitude?: number;
  longitude?: number;
  startDate: string;
  endDate?: string;
  coverImageUrl?: string;
  images?: string[];
  videoUrl?: string;
  totalCapacity: number;
  conditions?: string;
  refundPolicy?: string;
}

export async function createEvent(
  token: string,
  payload: CreateEventPayload
): Promise<{ event: Event }> {
  const res = await fetch(`${API_URL}/api/events`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<{ event: Event }>(res);
}

export async function updateEvent(
  token: string,
  eventId: string,
  payload: Partial<CreateEventPayload>
): Promise<{ event: Event }> {
  const res = await fetch(`${API_URL}/api/events/${eventId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<{ event: Event }>(res);
}

export async function getEvent(eventId: string, token?: string): Promise<{ event: Event }> {
  const res = await fetch(`${API_URL}/api/events/${eventId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return handleResponse<{ event: Event }>(res);
}

export async function publishEvent(token: string, eventId: string): Promise<{ event: Event }> {
  const res = await fetch(`${API_URL}/api/events/${eventId}/publish`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
  return handleResponse<{ event: Event }>(res);
}

export async function listMyEvents(token: string): Promise<{ events: Event[] }> {
  const res = await fetch(`${API_URL}/api/events/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ events: Event[] }>(res);
}

export interface ListEventsParams {
  category?: string;
  region?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListEventsResponse {
  events: Event[];
  total: number;
  page: number;
  limit: number;
}

export async function listEvents(params: ListEventsParams = {}): Promise<ListEventsResponse> {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.region) query.set("region", params.region);
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const res = await fetch(`${API_URL}/api/events?${query.toString()}`);
  return handleResponse<ListEventsResponse>(res);
}

export interface RegionStat {
  region: string;
  count: number;
}

export async function fetchRegionStats(): Promise<{ stats: RegionStat[] }> {
  const res = await fetch(`${API_URL}/api/events/stats/regions`);
  return handleResponse<{ stats: RegionStat[] }>(res);
}

// ---------- Reservations ----------

export interface Reservation {
  id: string;
  userId: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  totalAmount: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  qrCode: string | null;
  backupCode: string | null;
  paymentRef: string | null;
  checkedInAt: string | null;
  createdAt: string;
  event?: {
    id: string;
    title: string;
    startDate: string;
    location: string;
    coverImageUrl: string | null;
  };
  ticketType?: {
    id: string;
    name: string;
    price: string;
  };
}

export async function createReservation(
  token: string,
  payload: { ticketTypeId: string; quantity: number }
): Promise<{ reservation: Reservation; note?: string }> {
  const res = await fetch(`${API_URL}/api/reservations`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<{ reservation: Reservation; note?: string }>(res);
}

export async function confirmReservation(
  token: string,
  id: string
): Promise<{ reservation: Reservation }> {
  const res = await fetch(`${API_URL}/api/reservations/${id}/confirm`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
  return handleResponse<{ reservation: Reservation }>(res);
}

export async function cancelReservation(token: string, id: string): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/api/reservations/${id}/cancel`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
  return handleResponse<{ message: string }>(res);
}

export async function listMyReservations(token: string): Promise<{ reservations: Reservation[] }> {
  const res = await fetch(`${API_URL}/api/reservations/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ reservations: Reservation[] }>(res);
}

// ---------- Ticket types ----------

export interface CreateTicketTypePayload {
  name: string;
  description?: string;
  price: number;
  totalSeats: number;
  seatMapZone?: string;
  salesStart?: string;
  salesEnd?: string;
}

export async function createTicketType(
  token: string,
  eventId: string,
  payload: CreateTicketTypePayload
): Promise<{ ticketType: TicketType }> {
  const res = await fetch(`${API_URL}/api/events/${eventId}/ticket-types`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<{ ticketType: TicketType }>(res);
}

export async function listTicketTypes(
  eventId: string,
  token?: string
): Promise<{ ticketTypes: TicketType[] }> {
  const res = await fetch(`${API_URL}/api/events/${eventId}/ticket-types`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return handleResponse<{ ticketTypes: TicketType[] }>(res);
}

export async function updateTicketType(
  token: string,
  id: string,
  payload: Partial<CreateTicketTypePayload>
): Promise<{ ticketType: TicketType }> {
  const res = await fetch(`${API_URL}/api/ticket-types/${id}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<{ ticketType: TicketType }>(res);
}

export async function toggleTicketType(
  token: string,
  id: string
): Promise<{ ticketType: TicketType }> {
  const res = await fetch(`${API_URL}/api/ticket-types/${id}/toggle`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
  return handleResponse<{ ticketType: TicketType }>(res);
}

export async function deleteTicketType(token: string, id: string): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/api/ticket-types/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ message: string }>(res);
}

export async function reorderTicketTypes(
  token: string,
  eventId: string,
  order: { id: string; position: number }[]
): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/api/events/${eventId}/ticket-types/reorder`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ order }),
  });
  return handleResponse<{ message: string }>(res);
}