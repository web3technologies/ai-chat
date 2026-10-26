import "server-only";
import { MEMORY_MAX } from "@/backend/limits";
import { memoryRepository, type MemoryRepository } from "@/backend/repositories/memory";

export type MemoryView = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

export class MemoryService {
  constructor(private readonly memories: MemoryRepository) {}

  list(userId: string) {
    return this.memories.listForUser(userId);
  }

  async update(userId: string, id: string, content: string) {
    const trimmed = content.trim();
    if (!trimmed) return { ok: false as const, reason: "invalid" as const };
    if (trimmed.length > MEMORY_MAX) return { ok: false as const, reason: "too_long" as const };

    const existing = await this.memories.findOwned(id, userId);
    if (!existing) return { ok: false as const, reason: "not_found" as const };

    const memory = await this.memories.updateContent(id, trimmed);
    return { ok: true as const, memory };
  }

  async remove(userId: string, id: string) {
    const existing = await this.memories.findOwned(id, userId);
    if (!existing) return { ok: false as const, reason: "not_found" as const };

    await this.memories.remove(id);
    return { ok: true as const };
  }
}

export const memoryService = new MemoryService(memoryRepository);
