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
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: memorySelect,
    });
  }

  findOwned(id: string, userId: string) {
    return this.db.memory.findFirst({ where: { id, userId } });
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

  listForUsers(userIds: string[]) {
    return this.db.memory.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, content: true },
    });
  }

  create(userId: string, content: string) {
    return this.db.memory.create({ data: { userId, content } });
  }
}

export const memoryRepository = new MemoryRepository(prisma);
