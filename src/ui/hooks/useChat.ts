"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/ui/context/auth";
import { TOKEN_KEY } from "@/ui/hooks/useAuth";

export type ChatMember = {
  id: string;
  username: string | null;
  name: string;
  kind: "HUMAN" | "AGENT";
};

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
};

export type ChatSummary = {
  id: string;
  kind: "DM" | "GROUP";
  title: string;
  members: ChatMember[];
  latestMessage: ChatMessage | null;
};

export type ChatDetail = ChatSummary & {
  messages: ChatMessage[];
};

export type CreateChatInput = {
  kind: "DM" | "GROUP";
  usernames: string[];
  name?: string;
};

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    authorization: token ? `Bearer ${token}` : "",
    "content-type": "application/json",
  };
}

async function errorMessage(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
  if (data && typeof data.error === "string") return data.error;
  return "Request failed";
}

export default function useChat() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChatDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    void fetch("/api/chats", { headers: authHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error(await errorMessage(response));
        return (await response.json()) as { chats: ChatSummary[] };
      })
      .then((data) => {
        if (!cancelled) setChats(data.chats);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Request failed");
      });

    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;

    void fetch(`/api/chats/${selectedId}`, { headers: authHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error(await errorMessage(response));
        return (await response.json()) as { chat: ChatDetail };
      })
      .then((data) => {
        if (!cancelled) setSelected(data.chat);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Request failed");
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selectChat = useCallback((id: string | null) => {
    setSelectedId(id);
    if (!id) setSelected(null);
  }, []);

  const send = useCallback(
    async (body: string) => {
      if (!selectedId) return false;
      setError(null);
      try {
        const response = await fetch(`/api/chats/${selectedId}/send`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ body }),
        });
        if (!response.ok) {
          setError(await errorMessage(response));
          return false;
        }
        const data = (await response.json()) as { message: ChatMessage; agentMessage: ChatMessage | null };
        const messages = data.agentMessage ? [data.message, data.agentMessage] : [data.message];
        const latest = messages[messages.length - 1];
        setSelected((current) =>
          current && current.id === selectedId
            ? {
                ...current,
                latestMessage: latest,
                messages: [...current.messages, ...messages],
              }
            : current,
        );
        setChats((current) => {
          const next = current.map((chat) =>
            chat.id === selectedId ? { ...chat, latestMessage: latest } : chat,
          );
          const index = next.findIndex((chat) => chat.id === selectedId);
          if (index <= 0) return next;
          const [chat] = next.splice(index, 1);
          return [chat, ...next];
        });
        return true;
      } catch {
        setError("Request failed");
        return false;
      }
    },
    [selectedId],
  );

  const createChat = useCallback(async (input: CreateChatInput) => {
    setError(null);
    const response = await fetch("/api/chats", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(await errorMessage(response));
    const data = (await response.json()) as { chat: ChatDetail };
    const summary: ChatSummary = {
      id: data.chat.id,
      kind: data.chat.kind,
      title: data.chat.title,
      members: data.chat.members,
      latestMessage: data.chat.latestMessage,
    };
    setChats((current) => [summary, ...current.filter((chat) => chat.id !== summary.id)]);
    setSelected(data.chat);
    setSelectedId(data.chat.id);
  }, []);

  return {
    user,
    loading,
    signOut,
    chats,
    selected,
    selectedId,
    selectChat,
    send,
    createChat,
    error,
  };
}
