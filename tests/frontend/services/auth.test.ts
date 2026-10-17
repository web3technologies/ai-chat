import { beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "@/ui/services/auth";
import { TOKEN_KEY } from "@/ui/services/client";

const user = { id: "user-1", username: "sam", name: "Sam", kind: "HUMAN" as const };

function jsonResponse(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("AuthService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("stores the token on sign-in and sign-up", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { token: "signed", user }) as never);
    await expect(authService.signIn("sam", "secret")).resolves.toEqual(user);
    expect(localStorage.getItem(TOKEN_KEY)).toBe("signed");

    vi.mocked(fetch).mockResolvedValue(jsonResponse(201, { token: "newer", user }) as never);
    await authService.signUp("sam", "secret");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("newer");
  });

  it("returns null without a token and signs out when the session request fails", async () => {
    await expect(authService.current()).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();

    localStorage.setItem(TOKEN_KEY, "signed");
    vi.mocked(fetch).mockResolvedValue(jsonResponse(401, { error: "Unauthorized" }) as never);
    await expect(authService.current()).resolves.toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("returns the user list", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { users: [user] }) as never);
    await expect(authService.listUsers()).resolves.toEqual([user]);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/users");
  });
});
