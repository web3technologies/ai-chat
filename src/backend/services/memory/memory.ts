import "server-only";
import { MEMORY_MAX } from "@/backend/limits";
import { chatRepository, type ChatRepository } from "@/backend/repositories/chat";
import { memoryRepository, type MemoryRepository } from "@/backend/repositories/memory";
import { agent, type Agent, type MemoryOperation } from "@/backend/services/agent/agent";
import type { ActiveFact } from "./types";

export type { ActiveFact, MemoryView } from "./types";

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

    const humans = chat.members
      .map((member) => member.user)
      .filter((person) => person.kind === "HUMAN" && person.username);
    const humanIds = humans.map((person) => person.id);
    const visibility = humanIds.length === 1 ? "PRIVATE" : "PARTICIPANTS";
    const existing = await this.memories.listForUsers(humanIds);
    const facts = existing.flatMap((memory) => {
      const person = humans.find((candidate) => candidate.id === memory.userId);
      if (!person?.username) return [];
      return [{ id: memory.id, username: person.username, content: memory.content }];
    });
    const operations = await this.assistant.remember(chat.members, chat.messages.slice(0, index + 1), facts);
    const active = new Map(
      existing.map((memory) => [
        memory.id,
        {
          id: memory.id,
          userId: memory.userId,
          content: memory.content,
          visibility: memory.visibility,
          audienceIds: memory.audience.map((person) => person.userId),
        },
      ]),
    );
    const stored = await this.applyOperations(operations, humans, active, visibility, humanIds);
    if (stored === 0) console.log("[memory] nothing new");
  }

  private async applyOperations(
    operations: MemoryOperation[],
    humans: { id: string; name: string; username: string | null }[],
    active: Map<string, ActiveFact>,
    visibility: "PRIVATE" | "PARTICIPANTS",
    humanIds: string[],
  ) {
    const writes: Promise<void>[] = [];
    for (const operation of operations) {
      const write = this.operationWrite(operation, humans, active, visibility, humanIds);
      if (write) writes.push(write);
    }
    const applied = await Promise.all(writes);
    console.log(`[memory] applied ${applied.length}`);
    return applied.length;
  }

  private operationWrite(
    operation: MemoryOperation,
    humans: { id: string; name: string; username: string | null }[],
    active: Map<string, ActiveFact>,
    visibility: "PRIVATE" | "PARTICIPANTS",
    humanIds: string[],
  ): Promise<void> | null {
    switch (operation.op) {
      case "delete": {
        const current = typeof operation.id === "string" ? active.get(operation.id) : undefined;
        const owner = humans.find((person) => person.id === current?.userId);
        if (!current || !owner) return null;
        active.delete(current.id);
        return this.memories.supersede(current.id).then(() => {
          console.log(`[memory] forgot ${owner.name}: ${current.content}`);
        });
      }
      case "replace": {
        const current = typeof operation.id === "string" ? active.get(operation.id) : undefined;
        const owner = humans.find((person) => person.id === current?.userId);
        if (!current || !owner) return null;
        const named = typeof operation.username === "string" ? operation.username.trim().toLowerCase() : "";
        if (!named || named !== owner.username?.toLowerCase()) return null;
        if (typeof operation.content !== "string") return null;
        const contentText = operation.content.trim();
        if (!contentText || contentText.length > MEMORY_MAX) return null;
        if (contentText.toLowerCase() === current.content.trim().toLowerCase()) return null;
        active.delete(current.id);
        active.set(`pending:${current.id}`, {
          id: `pending:${current.id}`,
          userId: owner.id,
          content: contentText,
          visibility,
          audienceIds: humanIds,
        });
        return this.memories
          .supersede(current.id)
          .then(() => this.memories.create(owner.id, contentText, visibility, humanIds, current.id))
          .then(() => {
            console.log(`[memory] ${owner.name}: ${contentText}`);
          });
      }
      case "add": {
        if (typeof operation.username !== "string" || typeof operation.content !== "string") return null;
        const contentText = operation.content.trim();
        if (!contentText || contentText.length > MEMORY_MAX) return null;
        const person = humans.find(
          (candidate) => candidate.username?.toLowerCase() === operation.username?.toString().toLowerCase(),
        );
        if (!person) return null;
        const key = memoryKey(person.id, contentText, visibility, humanIds);
        const duplicate = [...active.values()].some(
          (memory) => memoryKey(memory.userId, memory.content, memory.visibility, memory.audienceIds) === key,
        );
        if (duplicate) return null;
        active.set(`pending:${key}`, {
          id: `pending:${key}`,
          userId: person.id,
          content: contentText,
          visibility,
          audienceIds: humanIds,
        });
        return this.memories.create(person.id, contentText, visibility, humanIds).then(() => {
          console.log(`[memory] ${person.name}: ${contentText}`);
        });
      }
      default:
        return null;
    }
  }
}

function memoryKey(userId: string, content: string, visibility: string, audienceIds: string[]) {
  return `${userId}:${visibility}:${[...audienceIds].sort().join(",")}:${content.trim().toLowerCase()}`;
}

export const memoryService = new MemoryService(memoryRepository, chatRepository, agent);
