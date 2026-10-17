import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/services/auth/token", () => ({
  authToken: { userIdFromRequest: vi.fn() },
}));

vi.mock("@/backend/services/memory/memory", () => ({
  memoryService: {
    list: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import { GET } from "@/app/api/memory/route";
import { PATCH, DELETE } from "@/app/api/memory/[id]/route";
import { authToken } from "@/backend/services/auth/token";
import { memoryService } from "@/backend/services/memory/memory";

const token = vi.mocked(authToken);
const memories = vi.mocked(memoryService);
const memory = {
  id: "m1",
  content: "likes pizza",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-02"),
};

function patch(content: unknown) {
  return new Request("http://localhost/api/memory/m1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

describe("memory routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    token.userIdFromRequest.mockResolvedValue("sam");
  });

  it("lists memories or returns 401", async () => {
    token.userIdFromRequest.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/api/memory"))).status).toBe(401);

    memories.list.mockResolvedValue([memory]);
    const response = await GET(new Request("http://localhost/api/memory"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ memories: [{ id: "m1", content: "likes pizza" }] });
  });

  it("updates a memory, rejects an empty one, and hides a missing row", async () => {
    const params = Promise.resolve({ id: "m1" });
    const empty = await PATCH(patch(""), { params });
    expect(empty.status).toBe(400);

    memories.update.mockResolvedValueOnce({ ok: false, reason: "not_found" });
    expect((await PATCH(patch("likes tacos"), { params })).status).toBe(404);

    memories.update.mockResolvedValueOnce({ ok: true, memory: { ...memory, content: "likes tacos" } });
    const response = await PATCH(patch("likes tacos"), { params });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ memory: { id: "m1", content: "likes tacos" } });
  });

  it("deletes a memory or returns 404", async () => {
    const params = Promise.resolve({ id: "m1" });
    memories.remove.mockResolvedValueOnce({ ok: true });
    expect((await DELETE(new Request("http://localhost"), { params })).status).toBe(204);

    memories.remove.mockResolvedValueOnce({ ok: false, reason: "not_found" });
    expect((await DELETE(new Request("http://localhost"), { params })).status).toBe(404);
  });
});
