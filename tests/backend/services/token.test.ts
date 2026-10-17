import { afterEach, describe, expect, it } from "vitest";
import { AuthToken } from "@/backend/services/auth/token";

describe("AuthToken", () => {
  const previous = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.JWT_SECRET = previous;
  });

  it("reads the user id back from a signed token", async () => {
    const tokens = new AuthToken();
    const token = await tokens.sign("user-1");
    await expect(tokens.userIdFrom(token)).resolves.toBe("user-1");
  });

  it("returns null for a bad token", async () => {
    await expect(new AuthToken().userIdFrom("not-a-token")).resolves.toBeNull();
  });

  it("throws when JWT_SECRET is missing", async () => {
    delete process.env.JWT_SECRET;
    await expect(new AuthToken().sign("user-1")).rejects.toThrow("JWT_SECRET is not set");
  });

  it("accepts only a bearer token", async () => {
    const tokens = new AuthToken();
    expect(tokens.fromRequest(new Request("http://localhost"))).toBeNull();
    expect(tokens.fromRequest(new Request("http://localhost", { headers: { authorization: "Basic abc" } }))).toBeNull();
    expect(
      tokens.fromRequest(new Request("http://localhost", { headers: { authorization: "Bearer signed" } })),
    ).toBe("signed");
  });

  it("returns null when the request has no token", async () => {
    await expect(new AuthToken().userIdFromRequest(new Request("http://localhost"))).resolves.toBeNull();
  });
});
