import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, TOKEN_KEY } from "@/ui/services/client";

function jsonResponse(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(async () => body),
  };
}

describe("api", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("sends the bearer token and skips the cache", async () => {
    localStorage.setItem(TOKEN_KEY, "signed");
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { ok: true }) as never);

    await api("/api/chats");

    expect(fetch).toHaveBeenCalledWith("/api/chats", {
      cache: "no-store",
      headers: { authorization: "Bearer signed", "content-type": "application/json" },
    });
  });

  it("throws the server error string", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(400, { error: "Nope" }) as never);
    await expect(api("/api/chats")).rejects.toThrow("Nope");
  });

  it("returns undefined for 204", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(204) as never);
    await expect(api("/api/memory/1")).resolves.toBeUndefined();
  });
});
