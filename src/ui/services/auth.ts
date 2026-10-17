"use client";

import { api, TOKEN_KEY } from "@/ui/services/client";

export type AuthUser = {
  id: string;
  username: string | null;
  name: string;
  kind: "HUMAN" | "AGENT";
};

class AuthService {
  async current(): Promise<AuthUser | null> {
    if (!localStorage.getItem(TOKEN_KEY)) return null;
    try {
      const data = await api<{ user: AuthUser }>("/api/auth/me");
      return data.user;
    } catch {
      this.signOut();
      return null;
    }
  }

  async signIn(username: string, password: string) {
    return this.submit("/api/auth/signin", username, password);
  }

  async signUp(username: string, password: string) {
    return this.submit("/api/auth/signup", username, password);
  }

  async listUsers() {
    const data = await api<{ users: AuthUser[] }>("/api/users");
    return data.users;
  }

  signOut() {
    localStorage.removeItem(TOKEN_KEY);
  }

  private async submit(path: string, username: string, password: string) {
    const data = await api<{ token: string; user: AuthUser }>(path, {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    return data.user;
  }
}

export const authService = new AuthService();
