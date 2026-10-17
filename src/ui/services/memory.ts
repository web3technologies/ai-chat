"use client";

import { api } from "@/ui/services/client";

export type MemoryItem = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

class MemoryService {
  async list() {
    const data = await api<{ memories: MemoryItem[] }>("/api/memory");
    return data.memories;
  }

  async update(id: string, content: string) {
    const data = await api<{ memory: MemoryItem }>(`/api/memory/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    });
    return data.memory;
  }

  async remove(id: string) {
    await api<void>(`/api/memory/${id}`, { method: "DELETE" });
  }
}

export const memoryService = new MemoryService();
