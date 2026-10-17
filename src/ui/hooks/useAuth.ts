"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authService, type AuthUser } from "@/ui/services/auth";

export type { AuthUser };

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

export function useAuthState(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(() => {
    authService.signOut();
    setUser(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      void (async () => {
        try {
          const next = await authService.current();
          if (cancelled) return;
          setUser(next);
        } catch (cause: unknown) {
          if (cancelled) return;
          setError(cause instanceof Error ? cause.message : "Request failed");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(async (action: "signIn" | "signUp", username: string, password: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const next = await authService[action](username, password);
      setUser(next);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }, []);

  const signIn = useCallback(
    (username: string, password: string) => submit("signIn", username, password),
    [submit],
  );

  const signUp = useCallback(
    (username: string, password: string) => submit("signUp", username, password),
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
