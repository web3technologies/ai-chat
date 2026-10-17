"use client";

import { useState } from "react";
import SignIn from "@/ui/components/SignIn";
import SignUp from "@/ui/components/SignUp";
import { useAuth } from "@/ui/context/auth";

export default function AuthScreen() {
  const { user, loading, signOut } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading...</p>;
  }

  if (user) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold">Signed in</h1>
        <p>You are {user.username}.</p>
        <button
          type="button"
          onClick={signOut}
          className="h-10 rounded-full bg-foreground text-background"
        >
          Sign out
        </button>
      </div>
    );
  }

  if (mode === "signup") {
    return <SignUp onSignIn={() => setMode("signin")} />;
  }

  return <SignIn onCreateAccount={() => setMode("signup")} />;
}
