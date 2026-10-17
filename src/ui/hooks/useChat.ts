"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/ui/context/auth";
import { chatService, type ChatDetail, type ChatSummary, type CreateChatInput } from "@/ui/services/chat";

export type { ChatDetail, ChatMember, ChatMessage, ChatSummary, CreateChatInput } from "@/ui/services/chat";

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

    void chatService
      .list()
      .then((next) => {
        if (!cancelled) setChats(next);
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

    void chatService
      .get(selectedId)
      .then((chat) => {
        if (!cancelled) setSelected(chat);
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
        const data = await chatService.send(selectedId, body);
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
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : "Request failed");
        return false;
      }
    },
    [selectedId],
  );

  const createChat = useCallback(async (input: CreateChatInput) => {
    setError(null);
    const chat = await chatService.create(input);
    const summary: ChatSummary = {
      id: chat.id,
      kind: chat.kind,
      title: chat.title,
      members: chat.members,
      latestMessage: chat.latestMessage,
    };
    setChats((current) => [summary, ...current.filter((item) => item.id !== summary.id)]);
    setSelected(chat);
    setSelectedId(chat.id);
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
