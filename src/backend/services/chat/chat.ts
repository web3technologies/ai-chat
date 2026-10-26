import "server-only";
import { GROUP_NAME_MAX, MESSAGE_MAX } from "@/backend/limits";
import { chatRepository, type ChatRepository } from "@/backend/repositories/chat";
import { userRepository, type UserRepository } from "@/backend/repositories/user";
import { Agent, agent } from "@/backend/services/agent/agent";
import { AuthToken, authToken } from "@/backend/services/auth/token";
import {
  chatKind,
  type ChatDetail,
  type ChatFailure,
  type ChatMessageView,
  type ChatRow,
  type ChatSummary,
  type MessageRow,
} from "@/backend/services/chat/types";

export class ChatService {
  constructor(
    private readonly chats: ChatRepository,
    private readonly users: UserRepository,
    private readonly tokens: AuthToken,
    private readonly assistant: Agent,
  ) {}

  async list(request: Request): Promise<{ ok: true; chats: ChatSummary[] } | ChatFailure> {
    const userId = await this.tokens.userIdFromRequest(request);
    if (!userId) return { ok: false, reason: "unauthorized" };

    const chats = await this.chats.listForMember(userId);

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

    const result = await this.chats.transaction(async (chats) => {
      if (input.kind === "DM") {
        const existing = await chats.findDirectMessage(userId, input.memberIds[1], memberIds);
        if (existing) {
          const hasAgent = existing.members.some((member) => member.userId === assistant.id);
          if (hasAgent) return { chat: existing, created: false };
          await chats.addMember(existing.id, assistant.id);
          const chat = await chats.findById(existing.id);
          return { chat, created: false };
        }
      }

      const chat = await chats.create(
        input.kind,
        input.kind === "GROUP" ? input.name : null,
        memberIds,
      );
      return { chat, created: true };
    });

    return { ok: true, chat: this.toDetail(result.chat, userId), created: result.created };
  }

  async get(request: Request, chatId: string): Promise<{ ok: true; chat: ChatDetail } | ChatFailure> {
    const userId = await this.tokens.userIdFromRequest(request);
    if (!userId) return { ok: false, reason: "unauthorized" };

    const chat = await this.chats.findForMember(chatId, userId);
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

    const membership = await this.chats.findMembership(chatId, userId);
    if (!membership) return { ok: false, reason: "not_found" };

    const message = await this.chats.saveMessage(chatId, userId, body.body);
    if (!message) return { ok: false, reason: "not_found" };

    const agentMessage = await this.agentReply(chatId);
    return { ok: true, message: this.toMessage(message), agentMessage };
  }

  private async agentReply(chatId: string): Promise<ChatMessageView | null> {
    try {
      const assistant = await this.assistant.user();
      const chat = await this.chats.findForAgent(chatId);
      if (!chat) return null;
      if (!chat.members.some((member) => member.userId === assistant.id)) {
        await this.chats.addMember(chatId, assistant.id);
      }

      const reply = await this.assistant.consider(chat.messages, chat.members);
      await this.assistant.remember(chat.members, chat.messages);
      if (!reply) return null;

      const created = await this.chats.saveMessage(chatId, assistant.id, reply);
      if (!created) return null;
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

    const caller = await this.users.findById(userId);
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

    const users = await this.users.findHumansByUsernames(requested);
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

export const chatService = new ChatService(chatRepository, userRepository, authToken, agent);
