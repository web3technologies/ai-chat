import { describe, expect, it } from "vitest";
import { PasswordHasher } from "@/backend/services/auth/password";

describe("PasswordHasher", () => {
  const hasher = new PasswordHasher();

  it("verifies a password against its hash", async () => {
    const stored = await hasher.hash("secret");
    await expect(hasher.verify("secret", stored)).resolves.toBe(true);
  });

  it("rejects a different password", async () => {
    const stored = await hasher.hash("secret");
    await expect(hasher.verify("other", stored)).resolves.toBe(false);
  });

  it("rejects a stored value that is not salt and key", async () => {
    await expect(hasher.verify("secret", "not-a-hash")).resolves.toBe(false);
  });

  it("uses a new salt for each hash", async () => {
    const first = await hasher.hash("secret");
    const second = await hasher.hash("secret");
    expect(first).not.toBe(second);
  });
});
