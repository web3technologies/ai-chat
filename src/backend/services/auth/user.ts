import "server-only";
import { Prisma, type User } from "@/backend/db/prisma/generated/client";
import prisma from "@/backend/db/prisma/client";
import { PasswordHasher, passwordHasher } from "@/backend/services/auth/password";
import { AuthToken, authToken } from "@/backend/services/auth/token";

export type PublicUser = {
  id: string;
  username: string | null;
  name: string;
  kind: User["kind"];
};

type Credentials = {
  username: string;
  password: string;
};

type AuthResult =
  | { ok: true; token: string; user: PublicUser }
  | { ok: false; reason: "invalid" | "taken" | "unauthorized" };

export class UserService {
  constructor(
    private readonly db: typeof prisma,
    private readonly passwords: PasswordHasher,
    private readonly tokens: AuthToken,
  ) {}

  async signup(request: Request): Promise<AuthResult> {
    const credentials = await this.credentialsFrom(request);
    if (!credentials) return { ok: false, reason: "invalid" };

    try {
      const user = await this.db.user.create({
        data: {
          name: credentials.username,
          username: credentials.username,
          passwordHash: await this.passwords.hash(credentials.password),
          kind: "HUMAN",
        },
      });
      return {
        ok: true,
        token: await this.tokens.sign(user.id),
        user: this.toPublic(user),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return { ok: false, reason: "taken" };
      }
      throw error;
    }
  }

  async signin(request: Request): Promise<AuthResult> {
    const credentials = await this.credentialsFrom(request);
    if (!credentials) return { ok: false, reason: "invalid" };

    const user = await this.db.user.findUnique({
      where: { username: credentials.username },
    });
    if (
      !user?.passwordHash ||
      !(await this.passwords.verify(credentials.password, user.passwordHash))
    ) {
      return { ok: false, reason: "unauthorized" };
    }

    return {
      ok: true,
      token: await this.tokens.sign(user.id),
      user: this.toPublic(user),
    };
  }

  async current(request: Request) {
    const userId = await this.tokens.userIdFromRequest(request);
    if (!userId) return null;

    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    return this.toPublic(user);
  }

  private toPublic(user: Pick<User, "id" | "username" | "name" | "kind">): PublicUser {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      kind: user.kind,
    };
  }

  private async credentialsFrom(request: Request): Promise<Credentials | null> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return null;
    }

    if (!body || typeof body !== "object") return null;

    const record = body as Record<string, unknown>;
    if (typeof record.username !== "string" || typeof record.password !== "string") {
      return null;
    }

    const username = record.username.trim();
    if (!username || !record.password) return null;

    return { username, password: record.password };
  }
}

export const userService = new UserService(prisma, passwordHasher, authToken);
