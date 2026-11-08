import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatRepository } from "@/backend/repositories/chat";
import { MemoryRepository } from "@/backend/repositories/memory";
import type { Agent } from "@/backend/services/agent/agent";
import { MemoryService } from "@/backend/services/memory/memory";

describe("MemoryService", () => {
  const rows = [
    { id: "m1", userId: "sam", content: "likes pizza", createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-02") },
  ];
  const db = {
    memory: {
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
        rows.filter((row) => row.userId === where.userId),
      ),
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) =>
        rows.find((row) => row.id === where.id && row.userId === where.userId) ?? null,
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { content: string } }) => {
        const row = rows.find((item) => item.id === where.id);
        return { ...row, content: data.content };
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const index = rows.findIndex((item) => item.id === where.id);
        if (index >= 0) rows.splice(index, 1);
      }),
    },
  };
  const findForAgent = vi.fn(async () => null as Awaited<ReturnType<ChatRepository["findForAgent"]>>);
  const assistant = { remember: vi.fn(async () => undefined) };
  const service = new MemoryService(
    new MemoryRepository(db as never),
    { findForAgent } as unknown as ChatRepository,
    assistant as unknown as Agent,
  );

  beforeEach(() => {
    findForAgent.mockReset();
    findForAgent.mockResolvedValue(null);
    assistant.remember.mockReset();
    assistant.remember.mockResolvedValue(undefined);
    rows.splice(0, rows.length, {
      id: "m1",
      userId: "sam",
      content: "likes pizza",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-02"),
    });
  });

  it("lists only that user's memories", async () => {
    await expect(service.list("sam")).resolves.toEqual([
      expect.objectContaining({ id: "m1", content: "likes pizza" }),
    ]);
    await expect(service.list("jordan")).resolves.toEqual([]);
  });

  it("rejects a blank update", async () => {
    await expect(service.update("sam", "m1", "   ")).resolves.toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects an update over the length cap", async () => {
    await expect(service.update("sam", "m1", "a".repeat(501))).resolves.toEqual({
      ok: false,
      reason: "too_long",
    });
  });

  it("hides another user's memory on update and delete", async () => {
    await expect(service.update("jordan", "m1", "nope")).resolves.toEqual({ ok: false, reason: "not_found" });
    await expect(service.remove("jordan", "m1")).resolves.toEqual({ ok: false, reason: "not_found" });
    expect(db.memory.delete).not.toHaveBeenCalled();
  });

  it("trims an update and deletes the owner's row", async () => {
    await expect(service.update("sam", "m1", "  likes tacos  ")).resolves.toEqual({
      ok: true,
      memory: expect.objectContaining({ content: "likes tacos" }),
    });
    await expect(service.remove("sam", "m1")).resolves.toEqual({ ok: true });
    expect(rows).toEqual([]);
  });

  it("remembers the transcript through a human message and skips an agent message", async () => {
    const human = {
      id: "message-human",
      body: "I like tacos",
      author: { name: "Sam", username: "sam", kind: "HUMAN" as const },
    };
    const chat = {
      members: [{ userId: "me", user: { id: "me", name: "Sam", username: "sam", kind: "HUMAN", memories: [] } }],
      messages: [human, { id: "message-agent", body: "Tacos it is", author: { kind: "AGENT" as const } }],
    };
    findForAgent.mockImplementation(async (chatId: string) => (chatId === "chat-1" ? chat : null));

    await service.rememberMessage("chat-1", "message-agent");
    await service.rememberMessage("chat-1", "missing");
    await service.rememberMessage("missing", "message-human");
    expect(assistant.remember).not.toHaveBeenCalled();

    await service.rememberMessage("chat-1", "message-human");

    expect(assistant.remember).toHaveBeenCalledOnce();
    expect(assistant.remember).toHaveBeenCalledWith(chat.members, [human]);
  });
});
