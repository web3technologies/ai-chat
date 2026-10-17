export const TOKEN_KEY = "moritz-chat-token";

export function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    authorization: token ? `Bearer ${token}` : "",
    "content-type": "application/json",
  };
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers },
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const message = data && typeof data.error === "string" ? data.error : "Request failed";
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
