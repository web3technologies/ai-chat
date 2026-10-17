"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/ui/context/auth";

const fieldClassName =
  "h-10 rounded-md border border-black/10 bg-transparent px-3 dark:border-white/15";

export default function SignIn({ onCreateAccount }: { onCreateAccount: () => void }) {
  const { signIn, error, submitting, clearError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void signIn(username, password);
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <label className="flex flex-col gap-1 text-sm">
        Username
        <input
          name="username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className={fieldClassName}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={fieldClassName}
          required
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="h-10 rounded-full bg-foreground text-background disabled:opacity-60"
      >
        Sign in
      </button>
      <button
        type="button"
        onClick={() => {
          clearError();
          onCreateAccount();
        }}
        className="text-sm underline"
      >
        No account? Sign up
      </button>
    </form>
  );
}
