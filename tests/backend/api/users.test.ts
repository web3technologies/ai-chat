import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/services/auth/user", () => ({
  userService: { list: vi.fn() },
}));

import { GET } from "@/app/api/users/route";
import { userService } from "@/backend/services/auth/user";

describe("GET /api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the user list", async () => {
    vi.mocked(userService.list).mockResolvedValue([
      { id: "user-1", username: "sam", name: "Sam", kind: "HUMAN" },
    ]);
    const response = await GET(new Request("http://localhost/api/users"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      users: [{ id: "user-1", username: "sam", name: "Sam", kind: "HUMAN" }],
    });
  });

  it("returns 401 when the caller is missing", async () => {
    vi.mocked(userService.list).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/users"));
    expect(response.status).toBe(401);
  });
});
