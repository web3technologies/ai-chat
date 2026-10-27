import "server-only";
import { Prisma } from "@/backend/db/prisma/generated/client";
import prisma from "@/backend/db/prisma/client";

const memberSelect = {
  id: true,
  username: true,
  name: true,
  kind: true,
} as const;

const detailInclude = {
  members: {
    include: { user: { select: memberSelect } },
    orderBy: { joinedAt: "asc" as const },
  },
  messages: {
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.ChatInclude;

export class ChatRepository {
  constructor(private readonly db: typeof prisma) {}

  transaction<T>(run: (chats: ChatRepository) => Promise<T>) {
    return this.db.$transaction((tx) => run(new ChatRepository(tx as typeof prisma)));
  }

  listForMember(userId: string) {
    return this.db.chat.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: detailInclude.members,
        messages: { ...detailInclude.messages, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  findForMember(chatId: string, userId: string) {
    return this.db.chat.findFirst({
      where: { id: chatId, members: { some: { userId } } },
      include: detailInclude,
    });
  }

  findDirectMessage(userId: string, otherUserId: string, memberIds: string[]) {
    return this.db.chat.findFirst({
      where: {
        kind: "DM",
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: otherUserId } } },
          { members: { every: { userId: { in: memberIds } } } },
        ],
      },
      include: detailInclude,
    });
  }

  findById(chatId: string) {
    return this.db.chat.findUniqueOrThrow({
      where: { id: chatId },
      include: detailInclude,
    });
  }

  create(kind: "DM" | "GROUP", name: string | null, memberIds: string[]) {
    return this.db.chat.create({
      data: {
        kind,
        name,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
      include: detailInclude,
    });
  }

  findMembership(chatId: string, userId: string) {
    return this.db.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
  }

  addMember(chatId: string, userId: string) {
    return this.db.chatMember.create({ data: { chatId, userId } });
  }

  findForAgent(chatId: string) {
    return this.db.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          include: {
            user: { include: { memories: { include: { audience: { select: { userId: true } } } } } },
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { author: true },
        },
      },
    });
  }

  async saveMessage(chatId: string, authorId: string, body: string) {
    try {
      return await this.db.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: { chatId, authorId, body },
          include: { author: { select: { name: true } } },
        });
        await tx.chat.update({
          where: { id: chatId },
          data: { updatedAt: new Date() },
        });
        return created;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2003" || error.code === "P2025")
      ) {
        return null;
      }
      throw error;
    }
  }
}

export const chatRepository = new ChatRepository(prisma);
