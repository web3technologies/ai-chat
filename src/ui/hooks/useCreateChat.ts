"use client";

import { FormEvent, useEffect, useState } from "react";
import { authService } from "@/ui/services/auth";
import type { CreateChatInput } from "@/ui/services/chat";

type Person = {
  id: string;
  username: string | null;
  name: string;
  kind: "HUMAN" | "AGENT";
};

export default function useCreateChat(
  currentUserId: string,
  onCreate: (input: CreateChatInput) => Promise<void>,
) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      try {
        const users = await authService.listUsers();
        if (cancelled) return;
        setPeople(
          users.filter(
            (person) => person.id !== currentUserId && person.username && person.kind !== "AGENT",
          ),
        );
      } catch (cause: unknown) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Could not load users");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, currentUserId]);

  function toggle(username: string) {
    setSelected((current) =>
      current.includes(username) ? current.filter((item) => item !== username) : [...current, username],
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (selected.length === 0) return;
    const kind = selected.length === 1 ? "DM" : "GROUP";
    if (kind === "GROUP" && !name.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        kind,
        usernames: selected,
        name: kind === "GROUP" ? name.trim() : undefined,
      });
      setOpen(false);
      setSelected([]);
      setName("");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not create chat");
    } finally {
      setSubmitting(false);
    }
  }

  return { open, setOpen, people, selected, name, setName, error, submitting, toggle, submit };
}
