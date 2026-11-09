import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatRepository } from "@/backend/repositories/chat";
import { MemoryRepository } from "@/backend/repositories/memory";
import type { Agent, MemoryOperation } from "@/backend/services/agent/agent";
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
  const findForAgent = vi.fn(async (_chatId: string) => null as Awaited<ReturnType<ChatRepository["findForAgent"]>>);
  const assistant = { remember: vi.fn(async (): Promise<MemoryOperation[]> => []) };
  const service = new MemoryService(
    new MemoryRepository(db as never),
    { findForAgent } as unknown as ChatRepository,
    assistant as unknown as Agent,
  );

  beforeEach(() => {
    findForAgent.mockReset();
    findForAgent.mockResolvedValue(null);
    assistant.remember.mockReset();
    assistant.remember.mockResolvedValue([]);
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
    findForAgent.mockImplementation(
      async (chatId: string) =>
        (chatId === "chat-1" ? chat : null) as Awaited<ReturnType<ChatRepository["findForAgent"]>>,
    );

    await service.rememberMessage("chat-1", "message-agent");
    await service.rememberMessage("chat-1", "missing");
    await service.rememberMessage("missing", "message-human");
    expect(assistant.remember).not.toHaveBeenCalled();

    await service.rememberMessage("chat-1", "message-human");

    expect(assistant.remember).toHaveBeenCalledOnce();
    expect(assistant.remember).toHaveBeenCalledWith(chat.members, [human], []);
  });
});

describe("MemoryService operations", () => {
  type Stored = {
    id: string;
    userId: string;
    content: string;
    visibility: "PRIVATE" | "PARTICIPANTS";
    status: "ACTIVE" | "SUPERSEDED";
    replacesId?: string;
    audience: { userId: string }[] | { create: { userId: string }[] };
  };
  const stored: Stored[] = [];
  const db = {
    memory: {
      findMany: vi.fn(async ({ where }: { where?: { status?: string; userId?: { in?: string[] } } } = {}) =>
        stored
          .filter((memory) => !where?.status || memory.status === where.status)
          .filter((memory) => !where?.userId?.in || where.userId.in.includes(memory.userId))
          .map((memory) => ({
            id: memory.id,
            userId: memory.userId,
            content: memory.content,
            visibility: memory.visibility,
            audience: Array.isArray(memory.audience) ? memory.audience : memory.audience.create,
          })),
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: {
            userId: string;
            content: string;
            visibility: "PRIVATE" | "PARTICIPANTS";
            replacesId?: string;
            audience: { create: { userId: string }[] };
          };
        }) => {
          const row = { id: `memory-${stored.length + 1}`, status: "ACTIVE" as const, ...data };
          stored.push(row);
          return row;
        },
      ),
      update: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = stored.find((memory) => memory.id === where.id);
        if (!row) return null;
        row.status = "SUPERSEDED";
        return row;
      }),
    },
  };
  const findForAgent = vi.fn();
  const assistant = { remember: vi.fn(async () => [] as { op: string; id: string; username: string; content: string }[]) };
  const service = new MemoryService(
    new MemoryRepository(db as never),
    { findForAgent } as unknown as ChatRepository,
    assistant as unknown as Agent,
  );
  const sam = { id: "user-sam", username: "sam", name: "Sam", kind: "HUMAN" as const, memories: [] };

  beforeEach(() => {
    stored.splice(0, stored.length);
    assistant.remember.mockReset();
  });

  function chat(body: string) {
    return {
      members: [{ user: sam }],
      messages: [{ id: "message-human", body, author: { kind: "HUMAN" as const } }],
    };
  }

  it("adds a fact, skips an exact repeat, replaces a changed fact, and deletes one taken back", async () => {
    findForAgent.mockResolvedValue(chat("I like pizza"));
    assistant.remember.mockResolvedValue([
      { op: "add", id: "", username: "sam", content: " likes pizza " },
      { op: "add", id: "", username: "sam", content: "Likes Pizza" },
      { op: "add", id: "", username: "missing", content: "lives on the moon" },
    ]);

    await service.rememberMessage("chat-1", "message-human");

    expect(stored).toEqual([
      expect.objectContaining({
        id: "memory-1",
        status: "ACTIVE",
        userId: "user-sam",
        content: "likes pizza",
        visibility: "PRIVATE",
      }),
    ]);

    stored.splice(0, stored.length, {
      id: "memory-pizza",
      userId: "user-sam",
      content: "likes pizza",
      visibility: "PRIVATE",
      status: "ACTIVE",
      audience: [{ userId: "user-sam" }],
    });
    assistant.remember.mockResolvedValue([{ op: "replace", id: "memory-pizza", username: "sam", content: "hates pizza" }]);
    await service.rememberMessage("chat-1", "message-human");
    expect(stored.map(({ id, status, content, replacesId }) => ({ id, status, content, replacesId }))).toEqual([
      { id: "memory-pizza", status: "SUPERSEDED", content: "likes pizza", replacesId: undefined },
      { id: "memory-2", status: "ACTIVE", content: "hates pizza", replacesId: "memory-pizza" },
    ]);

    stored.splice(0, stored.length, {
      id: "memory-pizza",
      userId: "user-sam",
      content: "likes pizza",
      visibility: "PRIVATE",
      status: "ACTIVE",
      audience: [{ userId: "user-sam" }],
    });
    assistant.remember.mockResolvedValue([{ op: "delete", id: "memory-pizza", username: "", content: "" }]);
    await service.rememberMessage("chat-1", "message-human");
    expect(stored).toEqual([
      expect.objectContaining({ id: "memory-pizza", status: "SUPERSEDED", content: "likes pizza" }),
    ]);
  });

  it("shares a new fact with everyone in the room", async () => {
    const jordan = { id: "user-jordan", username: "jordan", name: "Jordan", kind: "HUMAN" as const, memories: [] };
    findForAgent.mockResolvedValue({
      members: [{ user: sam }, { user: jordan }],
      messages: [{ id: "message-human", body: "I live in Austin", author: { kind: "HUMAN" as const } }],
    });
    assistant.remember.mockResolvedValue([{ op: "add", id: "", username: "sam", content: "lives in Austin" }]);

    await service.rememberMessage("chat-1", "message-human");

    expect(stored).toEqual([
      expect.objectContaining({
        userId: "user-sam",
        content: "lives in Austin",
        visibility: "PARTICIPANTS",
        audience: { create: [{ userId: "user-sam" }, { userId: "user-jordan" }] },
      }),
    ]);
  });
});
