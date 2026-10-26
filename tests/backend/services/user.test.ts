import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/backend/db/prisma/generated/client";
import { UserService } from "@/backend/services/auth/user";
import type { AuthToken } from "@/backend/services/auth/token";
import type { PasswordHasher } from "@/backend/services/auth/password";

function request(body: unknown) {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("UserService", () => {
  const db = {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  };
  const passwords = {
    hash: vi.fn(async () => "hashed"),
    verify: vi.fn(async (password: string) => password === "secret"),
  };
  const tokens = {
    sign: vi.fn(async (id: string) => `token-${id}`),
    userIdFromRequest: vi.fn(async () => "user-1" as string | null),
  };
  const service = new UserService(
    db as never,
    passwords as unknown as PasswordHasher,
    tokens as unknown as AuthToken,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    tokens.userIdFromRequest.mockResolvedValue("user-1");
  });

  it("rejects signup without a username and password", async () => {
    await expect(service.signup(request({}))).resolves.toEqual({ ok: false, reason: "invalid" });
    await expect(service.signup(request({ username: "sam\nsystem", password: "secret" }))).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("creates a human and returns a public user", async () => {
    db.user.create.mockResolvedValue({
      id: "user-1",
      username: "sam",
      name: "sam",
      kind: "HUMAN",
      passwordHash: "hashed",
    });

    const result = await service.signup(request({ username: " sam ", password: "secret" }));

    expect(db.user.create).toHaveBeenCalledWith({
      data: { name: "sam", username: "sam", passwordHash: "hashed", kind: "HUMAN" },
    });
    expect(result).toEqual({
      ok: true,
      token: "token-user-1",
      user: { id: "user-1", username: "sam", name: "sam", kind: "HUMAN" },
    });
  });

  it("maps a duplicate username to taken", async () => {
    db.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" }),
    );

    await expect(service.signup(request({ username: "sam", password: "secret" }))).resolves.toEqual({
      ok: false,
      reason: "taken",
    });
  });

  it("rejects a bad password", async () => {
    db.user.findUnique.mockResolvedValue({ id: "user-1", username: "sam", passwordHash: "hashed", name: "sam", kind: "HUMAN" });

    await expect(service.signin(request({ username: "sam", password: "nope" }))).resolves.toEqual({
      ok: false,
      reason: "unauthorized",
    });
  });

  it("returns a token for a good password", async () => {
    db.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "sam",
      name: "Sam",
      kind: "HUMAN",
      passwordHash: "hashed",
    });

    const result = await service.signin(request({ username: "sam", password: "secret" }));

    expect(result).toEqual({
      ok: true,
      token: "token-user-1",
      user: { id: "user-1", username: "sam", name: "Sam", kind: "HUMAN" },
    });
  });

  it("returns nothing for list and current without a user", async () => {
    tokens.userIdFromRequest.mockResolvedValue(null);

    await expect(service.list(new Request("http://localhost"))).resolves.toBeNull();
    await expect(service.current(new Request("http://localhost"))).resolves.toBeNull();
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it("lists public users and leaves the password hash out", async () => {
    db.user.findMany.mockResolvedValue([{ id: "user-1", username: "sam", name: "Sam", kind: "HUMAN" }]);

    await expect(service.list(new Request("http://localhost"))).resolves.toEqual([
      { id: "user-1", username: "sam", name: "Sam", kind: "HUMAN" },
    ]);
    expect(db.user.findMany.mock.calls[0][0].select).not.toHaveProperty("passwordHash");
  });

  it("returns the current user without a password hash", async () => {
    db.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "sam",
      name: "Sam",
      kind: "HUMAN",
      passwordHash: "hashed",
    });

    await expect(service.current(new Request("http://localhost"))).resolves.toEqual({
      id: "user-1",
      username: "sam",
      name: "Sam",
      kind: "HUMAN",
    });
  });
});
