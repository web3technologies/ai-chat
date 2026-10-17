"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SignIn from "@/ui/components/SignIn";
import SignUp from "@/ui/components/SignUp";
import { useAuth } from "@/ui/context/auth";

export default function AuthScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    if (!loading && user) router.replace("/chat");
  }, [loading, user, router]);

  if (loading || user) {
    return <p className="text-sm text-zinc-500">Loading...</p>;
  }

  if (mode === "signup") {
    return <SignUp onSignIn={() => setMode("signin")} />;
  }

  return <SignIn onCreateAccount={() => setMode("signup")} />;
}
