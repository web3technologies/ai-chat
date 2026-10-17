import "server-only";
import prisma from "@/backend/db/prisma/client";

export type MemoryView = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

const memorySelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class MemoryService {
  constructor(private readonly db: typeof prisma) {}

  async list(userId: string) {
    return this.db.memory.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: memorySelect,
    });
  }

  async update(userId: string, id: string, content: string) {
    const trimmed = content.trim();
    if (!trimmed) return { ok: false as const, reason: "invalid" as const };

    const existing = await this.db.memory.findFirst({ where: { id, userId } });
    if (!existing) return { ok: false as const, reason: "not_found" as const };

    const memory = await this.db.memory.update({
      where: { id },
      data: { content: trimmed },
      select: memorySelect,
    });
    return { ok: true as const, memory };
  }

  async remove(userId: string, id: string) {
    const existing = await this.db.memory.findFirst({ where: { id, userId } });
    if (!existing) return { ok: false as const, reason: "not_found" as const };

    await this.db.memory.delete({ where: { id } });
    return { ok: true as const };
  }
}

export const memoryService = new MemoryService(prisma);
