import "server-only";
import prisma from "@/backend/db/prisma/client";

const memorySelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class MemoryRepository {
  constructor(private readonly db: typeof prisma) {}

  listForUser(userId: string) {
    return this.db.memory.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: memorySelect,
    });
  }

  findOwned(id: string, userId: string) {
    return this.db.memory.findFirst({ where: { id, userId, status: "ACTIVE" } });
  }

  updateContent(id: string, content: string) {
    return this.db.memory.update({
      where: { id },
      data: { content },
      select: memorySelect,
    });
  }

  remove(id: string) {
    return this.db.memory.delete({ where: { id } });
  }

  supersede(id: string) {
    return this.db.memory.update({
      where: { id },
      data: { status: "SUPERSEDED", supersededAt: new Date() },
    });
  }

  listForUsers(userIds: string[]) {
    return this.db.memory.findMany({
      where: { userId: { in: userIds }, status: "ACTIVE" },
      select: {
        id: true,
        userId: true,
        content: true,
        visibility: true,
        audience: { select: { userId: true } },
      },
    });
  }

  create(
    userId: string,
    content: string,
    visibility: "PRIVATE" | "PARTICIPANTS",
    audienceIds: string[],
    replacesId?: string,
  ) {
    return this.db.memory.create({
      data: {
        userId,
        content,
        visibility,
        ...(replacesId ? { replacesId } : {}),
        audience: { create: audienceIds.map((id) => ({ userId: id })) },
      },
    });
  }
}

export const memoryRepository = new MemoryRepository(prisma);
