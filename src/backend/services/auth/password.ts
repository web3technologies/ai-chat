import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export class PasswordHasher {
  constructor(private readonly keyLength = 64) {}

  async hash(password: string) {
    const salt = randomBytes(16).toString("hex");
    const derived = (await scryptAsync(password, salt, this.keyLength)) as Buffer;
    return `${salt}:${derived.toString("hex")}`;
  }

  async verify(password: string, stored: string) {
    const [salt, key] = stored.split(":");
    if (!salt || !key) return false;

    const keyBuffer = Buffer.from(key, "hex");
    const derived = (await scryptAsync(password, salt, this.keyLength)) as Buffer;
    if (derived.length !== keyBuffer.length) return false;

    return timingSafeEqual(derived, keyBuffer);
  }
}

export const passwordHasher = new PasswordHasher();
