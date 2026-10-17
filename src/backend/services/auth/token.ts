import "server-only";
import { SignJWT, jwtVerify } from "jose";

export class AuthToken {
  constructor(private readonly expiresIn = "7d") {}

  async sign(userId: string) {
    return new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(this.expiresIn)
      .sign(this.secretKey());
  }

  async userIdFrom(token: string) {
    try {
      const { payload } = await jwtVerify(token, this.secretKey());
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }

  fromRequest(request: Request) {
    const header = request.headers.get("authorization");
    if (!header) return null;

    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) return null;

    return token;
  }

  async userIdFromRequest(request: Request) {
    const token = this.fromRequest(request);
    if (!token) return null;
    return this.userIdFrom(token);
  }

  private secretKey() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET is not set");
    }
    return new TextEncoder().encode(secret);
  }
}

export const authToken = new AuthToken();
