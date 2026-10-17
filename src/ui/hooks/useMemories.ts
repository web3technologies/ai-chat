"use client";

import { useCallback, useEffect, useState } from "react";
import { memoryService, type MemoryItem } from "@/ui/services/memory";

export type { MemoryItem };

export default function useMemories() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await memoryService.list();
        if (cancelled) return;
        setMemories(next);
      } catch (cause: unknown) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Request failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (id: string, content: string) => {
    setError(null);
    try {
      const memory = await memoryService.update(id, content);
      setMemories((current) => current.map((item) => (item.id === id ? memory : item)));
      return true;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Request failed");
      return false;
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setError(null);
    try {
      await memoryService.remove(id);
      setMemories((current) => current.filter((memory) => memory.id !== id));
      return true;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Request failed");
      return false;
    }
  }, []);

  return { memories, loading, error, update, remove };
}
