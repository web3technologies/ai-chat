import { beforeEach, describe, expect, it, vi } from "vitest";
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
  const service = new MemoryService(db as never);

  beforeEach(() => {
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
});
