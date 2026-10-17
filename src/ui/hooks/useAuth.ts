"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export const TOKEN_KEY = "moritz-chat-token";

export type AuthUser = {
  id: string;
  username: string | null;
  name: string;
  kind: "HUMAN" | "AGENT";
};

export type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOut: () => void;
  clearError: () => void;
};

async function errorMessage(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
  if (data && typeof data.error === "string") return data.error;
  return "Request failed";
}

export function useAuthState(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    let cancelled = false;

    if (!token) {
      queueMicrotask(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (cancelled) return;
      void fetch("/api/auth/me", {
        headers: { authorization: `Bearer ${token}` },
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("unauthorized");
          return (await response.json()) as { user: AuthUser };
        })
        .then((data) => {
          if (!cancelled) setUser(data.user);
        })
        .catch(() => {
          if (!cancelled) localStorage.removeItem(TOKEN_KEY);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(async (path: string, username: string, password: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        setError(await errorMessage(response));
        return;
      }
      const data = (await response.json()) as { token: string; user: AuthUser };
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
    } catch {
      setError("Request failed");
    } finally {
      setSubmitting(false);
    }
  }, []);

  const signIn = useCallback(
    (username: string, password: string) => submit("/api/auth/signin", username, password),
    [submit],
  );

  const signUp = useCallback(
    (username: string, password: string) => submit("/api/auth/signup", username, password),
    [submit],
  );

  return useMemo(
    () => ({
      user,
      loading,
      submitting,
      error,
      signIn,
      signUp,
      signOut,
      clearError,
    }),
    [user, loading, submitting, error, signIn, signUp, signOut, clearError],
  );
}
