import "server-only";
import { Prisma } from "@/backend/db/prisma/generated/client";
import prisma from "@/backend/db/prisma/client";

const publicSelect = {
  id: true,
  username: true,
  name: true,
  kind: true,
} as const;

export class UserRepository {
  constructor(private readonly db: typeof prisma) {}

  async createHuman(username: string, passwordHash: string) {
    try {
      return await this.db.user.create({
        data: { name: username, username, passwordHash, kind: "HUMAN" },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
      throw error;
    }
  }

  findByUsername(username: string) {
    return this.db.user.findUnique({ where: { username } });
  }

  findById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }

  list() {
    return this.db.user.findMany({
      select: publicSelect,
      orderBy: { name: "asc" },
    });
  }

  findHumansByUsernames(usernames: string[]) {
    return this.db.user.findMany({
      where: { username: { in: usernames }, kind: "HUMAN" },
      select: { id: true, username: true },
    });
  }

  ensureAgent() {
    return this.db.user.upsert({
      where: { username: "agent" },
      update: { name: "Agent", kind: "AGENT" },
      create: { username: "agent", name: "Agent", kind: "AGENT" },
    });
  }
}

export const userRepository = new UserRepository(prisma);
