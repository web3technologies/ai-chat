import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/services/auth/user", () => ({
  userService: {
    signup: vi.fn(),
    signin: vi.fn(),
    current: vi.fn(),
  },
}));

import { POST as signUp } from "@/app/api/auth/signup/route";
import { POST as signIn } from "@/app/api/auth/signin/route";
import { GET as currentUser } from "@/app/api/auth/me/route";
import { userService } from "@/backend/services/auth/user";

const users = vi.mocked(userService);
const person = { id: "user-1", username: "sam", name: "Sam", kind: "HUMAN" as const };

function request(body: unknown) {
  return new Request("http://localhost/api", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an account", async () => {
    users.signup.mockResolvedValue({ ok: true, token: "signed", user: person });
    const response = await signUp(request({ username: "sam", password: "secret" }));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ token: "signed", user: person });
  });

  it("rejects a taken username and an invalid signup", async () => {
    users.signup.mockResolvedValueOnce({ ok: false, reason: "taken" });
    const taken = await signUp(request({ username: "sam", password: "secret" }));
    expect(taken.status).toBe(409);

    users.signup.mockResolvedValueOnce({ ok: false, reason: "invalid" });
    const invalid = await signUp(request({}));
    expect(invalid.status).toBe(400);
  });

  it("signs in or rejects the password", async () => {
    users.signin.mockResolvedValueOnce({ ok: true, token: "signed", user: person });
    const ok = await signIn(request({ username: "sam", password: "secret" }));
    expect(ok.status).toBe(200);

    users.signin.mockResolvedValueOnce({ ok: false, reason: "unauthorized" });
    const denied = await signIn(request({ username: "sam", password: "nope" }));
    expect(denied.status).toBe(401);
  });

  it("returns the current user or 401", async () => {
    users.current.mockResolvedValueOnce(person);
    const ok = await currentUser(new Request("http://localhost/api/auth/me"));
    expect(ok.status).toBe(200);
    await expect(ok.json()).resolves.toEqual({ user: person });

    users.current.mockResolvedValueOnce(null);
    const denied = await currentUser(new Request("http://localhost/api/auth/me"));
    expect(denied.status).toBe(401);
  });
});
