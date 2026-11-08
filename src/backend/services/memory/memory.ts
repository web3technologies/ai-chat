import "server-only";
import { MEMORY_MAX } from "@/backend/limits";
import { chatRepository, type ChatRepository } from "@/backend/repositories/chat";
import { memoryRepository, type MemoryRepository } from "@/backend/repositories/memory";
import { agent, type Agent } from "@/backend/services/agent/agent";

export type MemoryView = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

export class MemoryService {
  constructor(
    private readonly memories: MemoryRepository,
    private readonly chats: ChatRepository,
    private readonly assistant: Agent,
  ) {}

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

  async rememberMessage(chatId: string, messageId: string) {
    const chat = await this.chats.findForAgent(chatId);
    if (!chat) return;
    const index = chat.messages.findIndex((message) => message.id === messageId);
    if (index < 0) return;
    if (chat.messages[index]?.author.kind !== "HUMAN") return;
    await this.assistant.remember(chat.members, chat.messages.slice(0, index + 1));
  }
}

export const memoryService = new MemoryService(memoryRepository, chatRepository, agent);
