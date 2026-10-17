import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoryService } from "@/ui/services/memory";

const memory = {
  id: "m1",
  content: "likes pizza",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

function jsonResponse(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("MemoryService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("lists, updates, and deletes memories", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(200, { memories: [memory] }) as never)
      .mockResolvedValueOnce(jsonResponse(200, { memory: { ...memory, content: "likes tacos" } }) as never)
      .mockResolvedValueOnce(jsonResponse(204) as never);

    await expect(memoryService.list()).resolves.toEqual([memory]);
    await expect(memoryService.update("m1", "likes tacos")).resolves.toEqual({ ...memory, content: "likes tacos" });
    await expect(memoryService.remove("m1")).resolves.toBeUndefined();

    expect(vi.mocked(fetch).mock.calls.map((call) => [call[0], (call[1] as RequestInit | undefined)?.method])).toEqual([
      ["/api/memory", undefined],
      ["/api/memory/m1", "PATCH"],
      ["/api/memory/m1", "DELETE"],
    ]);
  });
});
