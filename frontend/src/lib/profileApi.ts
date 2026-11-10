const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://tapakila.onrender.com";

export type Profile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl: string | null;
  phone: string | null;
  city: string | null;
  birthDate: string | null;
  createdAt: string;
};

export type ProfileUpdate = {
  firstName: string;
  lastName: string;
  phone: string | null;
  city: string | null;
  birthDate: string | null;
};

async function request(token: string, method: "GET" | "PATCH", body?: ProfileUpdate): Promise<Profile> {
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetch(`${API_URL}/api/users/me`, init);
  const json = (await res.json().catch(() => null)) as { user?: Profile; error?: string } | null;

  if (!res.ok || !json?.user) {
    throw new Error(json?.error ?? "Une erreur est survenue");
  }
  return json.user;
}

export function fetchProfile(token: string): Promise<Profile> {
  return request(token, "GET");
}

export function saveProfile(token: string, payload: ProfileUpdate): Promise<Profile> {
  return request(token, "PATCH", payload);
}