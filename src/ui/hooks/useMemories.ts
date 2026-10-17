"use client";

import { useCallback, useEffect, useState } from "react";
import { TOKEN_KEY } from "@/ui/hooks/useAuth";

export type MemoryItem = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    authorization: token ? `Bearer ${token}` : "",
    "content-type": "application/json",
  };
}

async function errorMessage(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
  if (data && typeof data.error === "string") return data.error;
  return "Request failed";
}

export default function useMemories() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/memory", { headers: authHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error(await errorMessage(response));
        return (await response.json()) as { memories: MemoryItem[] };
      })
      .then((data) => {
        if (!cancelled) setMemories(data.memories);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Request failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (id: string, content: string) => {
    setError(null);
    const response = await fetch(`/api/memory/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ content }),
    });
    if (!response.ok) {
      setError(await errorMessage(response));
      return false;
    }
    const data = (await response.json()) as { memory: MemoryItem };
    setMemories((current) => current.map((memory) => (memory.id === id ? data.memory : memory)));
    return true;
  }, []);

  const remove = useCallback(async (id: string) => {
    setError(null);
    const response = await fetch(`/api/memory/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!response.ok) {
      setError(await errorMessage(response));
      return false;
    }
    setMemories((current) => current.filter((memory) => memory.id !== id));
    return true;
  }, []);

  return { memories, loading, error, update, remove };
}
