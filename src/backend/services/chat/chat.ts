import "server-only";
import { Prisma } from "@/backend/db/prisma/generated/client";
import prisma from "@/backend/db/prisma/client";
import { GROUP_NAME_MAX, MESSAGE_MAX } from "@/backend/limits";
import { Agent, agent } from "@/backend/services/agent/agent";
import { AuthToken, authToken } from "@/backend/services/auth/token";
import {
  chatKind,
  detailInclude,
  type ChatDetail,
  type ChatFailure,
  type ChatMessageView,
  type ChatRow,
  type ChatSummary,
  type MessageRow,
} from "@/backend/services/chat/types";

export class ChatService {
  constructor(
    private readonly db: typeof prisma,
    private readonly tokens: AuthToken,
    private readonly assistant: Agent,
  ) {}

  async list(request: Request): Promise<{ ok: true; chats: ChatSummary[] } | ChatFailure> {
    const userId = await this.tokens.userIdFromRequest(request);
    if (!userId) return { ok: false, reason: "unauthorized" };

    const chats = await this.db.chat.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: detailInclude.members,
        messages: { ...detailInclude.messages, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });

    return { ok: true, chats: chats.map((chat) => this.toSummary(chat, userId)) };
  }

  async create(
    request: Request,
  ): Promise<{ ok: true; chat: ChatDetail; created: boolean } | ChatFailure> {
    const userId = await this.tokens.userIdFromRequest(request);
    if (!userId) return { ok: false, reason: "unauthorized" };

    const input = await this.createInput(request, userId);
    if (!input.ok) return input;

    const assistant = await this.assistant.user();
    const memberIds = [...input.memberIds, assistant.id];

    const result = await this.db.$transaction(async (tx) => {
      if (input.kind === "DM") {
        const existing = await tx.chat.findFirst({
          where: {
            kind: "DM",
            AND: [
              { members: { some: { userId } } },
              { members: { some: { userId: input.memberIds[1] } } },
              { members: { every: { userId: { in: memberIds } } } },
            ],
          },
          include: detailInclude,
        });
        if (existing) {
          const hasAgent = existing.members.some((member) => member.userId === assistant.id);
          if (hasAgent) return { chat: existing, created: false };
          await tx.chatMember.create({ data: { chatId: existing.id, userId: assistant.id } });
          const chat = await tx.chat.findUniqueOrThrow({
            where: { id: existing.id },
            include: detailInclude,
          });
          return { chat, created: false };
        }
      }

      const chat = await tx.chat.create({
        data: {
          kind: input.kind,
          name: input.kind === "GROUP" ? input.name : null,
          members: { create: memberIds.map((memberId) => ({ userId: memberId })) },
        },
        include: detailInclude,
      });
      return { chat, created: true };
    });

    return { ok: true, chat: this.toDetail(result.chat, userId), created: result.created };
  }

  async get(request: Request, chatId: string): Promise<{ ok: true; chat: ChatDetail } | ChatFailure> {
    const userId = await this.tokens.userIdFromRequest(request);
    if (!userId) return { ok: false, reason: "unauthorized" };

    const chat = await this.db.chat.findFirst({
      where: { id: chatId, members: { some: { userId } } },
      include: detailInclude,
    });
    if (!chat) return { ok: false, reason: "not_found" };

    return { ok: true, chat: this.toDetail(chat, userId) };
  }

  async send(
    request: Request,
    chatId: string,
  ): Promise<{ ok: true; message: ChatMessageView; agentMessage: ChatMessageView | null } | ChatFailure> {
    const userId = await this.tokens.userIdFromRequest(request);
    if (!userId) return { ok: false, reason: "unauthorized" };

    const body = await this.messageBody(request);
    if (!body.ok) return body;

    const membership = await this.db.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!membership) return { ok: false, reason: "not_found" };

    try {
      const message = await this.db.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: { chatId, authorId: userId, body: body.body },
          include: { author: { select: { name: true } } },
        });
        await tx.chat.update({
          where: { id: chatId },
          data: { updatedAt: new Date() },
        });
        return created;
      });

      const agentMessage = await this.agentReply(chatId);
      return { ok: true, message: this.toMessage(message), agentMessage };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2003" || error.code === "P2025")
      ) {
        return { ok: false, reason: "not_found" };
      }
      throw error;
    }
  }

  private async agentReply(chatId: string): Promise<ChatMessageView | null> {
    try {
      const assistant = await this.assistant.user();
      const membership = await this.db.chatMember.findUnique({
        where: { chatId_userId: { chatId, userId: assistant.id } },
      });
      if (!membership) {
        await this.db.chatMember.create({ data: { chatId, userId: assistant.id } });
      }

      const people = await this.db.chatMember.findMany({
        where: { chatId, user: { kind: "HUMAN" } },
        select: { user: { select: { id: true, username: true, name: true } } },
      });
      const memories = await this.db.memory.findMany({
        where: { userId: { in: people.map((member) => member.user.id) } },
        include: { user: { select: { name: true } } },
      });
      const history = await this.db.message.findMany({
        where: { chatId },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, username: true, kind: true } } },
      });
      const reply = await this.assistant.consider(
        history.map((message) => ({
          authorName: message.author.name,
          kind: message.author.kind,
          body: message.body,
        })),
        memories.map((memory) => ({ name: memory.user.name, content: memory.content })),
      );
      await this.assistant.remember(
        people.map((member) => member.user),
        history.map((message) => ({
          username: message.author.username,
          name: message.author.name,
          kind: message.author.kind,
          body: message.body,
        })),
      );
      if (!reply) return null;

      const created = await this.db.message.create({
        data: { chatId, authorId: assistant.id, body: reply },
        include: { author: { select: { name: true } } },
      });
      await this.db.chat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() },
      });
      return this.toMessage(created);
    } catch {
      return null;
    }
  }

  private async createInput(request: Request, userId: string) {
    const record = await this.jsonRecord(request);
    const kind = chatKind(record?.kind);
    if (!record || !kind) {
      return { ok: false as const, reason: "invalid" as const, error: "Kind must be DM or GROUP" };
    }
    if (!Array.isArray(record.usernames)) {
      return { ok: false as const, reason: "invalid" as const, error: "Usernames are required" };
    }

    const caller = await this.db.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    const requested = [
      ...new Set(
        record.usernames
          .filter((username): username is string => typeof username === "string")
          .map((username) => username.trim())
          .filter((username) => username && username !== caller?.username),
      ),
    ];
    if (requested.length === 0) {
      return {
        ok: false as const,
        reason: "invalid" as const,
        error: "A chat needs at least one other person",
      };
    }
    if (kind === "DM" && requested.length > 1) {
      return {
        ok: false as const,
        reason: "invalid" as const,
        error: "A direct message can only include one other person",
      };
    }

    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (kind === "GROUP" && !name) {
      return { ok: false as const, reason: "invalid" as const, error: "A group needs a name" };
    }
    if (kind === "GROUP" && name.length > GROUP_NAME_MAX) {
      return { ok: false as const, reason: "invalid" as const, error: "A group name is too long" };
    }

    const users = await this.db.user.findMany({
      where: { username: { in: requested }, kind: "HUMAN" },
      select: { id: true, username: true },
    });
    if (users.length !== requested.length) {
      return { ok: false as const, reason: "invalid" as const, error: "Unknown username" };
    }

    return {
      ok: true as const,
      kind,
      name,
      memberIds: [userId, ...users.map((user) => user.id)],
    };
  }

  private async messageBody(request: Request) {
    const record = await this.jsonRecord(request);
    if (!record || typeof record.body !== "string" || !record.body.trim()) {
      return { ok: false as const, reason: "invalid" as const, error: "Message body is required" };
    }
    const body = record.body.trim();
    if (body.length > MESSAGE_MAX) {
      return { ok: false as const, reason: "invalid" as const, error: "Message is too long" };
    }
    return { ok: true as const, body };
  }

  private async jsonRecord(request: Request) {
    try {
      const body = (await request.json()) as unknown;
      if (!body || typeof body !== "object" || Array.isArray(body)) return null;
      return body as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private toSummary(chat: ChatRow, userId: string): ChatSummary {
    const latest = chat.messages[0];
    return {
      id: chat.id,
      kind: chat.kind,
      title: this.title(chat, userId),
      members: chat.members.map((member) => member.user),
      latestMessage: latest ? this.toMessage(latest) : null,
    };
  }

  private toDetail(chat: ChatRow, userId: string): ChatDetail {
    const summary = this.toSummary({ ...chat, messages: chat.messages.slice(-1) }, userId);
    return {
      ...summary,
      messages: chat.messages.map((message) => this.toMessage(message)),
    };
  }

  private toMessage(message: MessageRow): ChatMessageView {
    return {
      id: message.id,
      body: message.body,
      createdAt: message.createdAt,
      authorId: message.authorId,
      authorName: message.author.name,
    };
  }

  private title(chat: ChatRow, userId: string) {
    if (chat.kind === "GROUP") return chat.name?.trim() || "Group";
    return chat.members.find((member) => member.userId !== userId && member.user.kind !== "AGENT")
      ?.user.name ?? "Direct message";
  }
}

export const chatService = new ChatService(prisma, authToken, agent);
