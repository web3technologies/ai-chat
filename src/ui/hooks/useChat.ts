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
    let version = 0;

    const load = async () => {
      const request = ++version;
      try {
        const next = await chatService.list();
        if (cancelled || request !== version) return;
        setChats(next);
      } catch (cause: unknown) {
        if (cancelled || request !== version) return;
        setError(cause instanceof Error ? cause.message : "Request failed");
      }
    };

    void load();
    const timer = setInterval(() => void load(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [loading, user]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    let version = 0;

    const load = async () => {
      const request = ++version;
      try {
        const chat = await chatService.get(selectedId);
        if (cancelled || request !== version) return;
        setSelected((current) => {
          if (current?.id === chat.id && current.messages.length > chat.messages.length) return current;
          return chat;
        });
      } catch (cause: unknown) {
        if (cancelled || request !== version) return;
        setError(cause instanceof Error ? cause.message : "Request failed");
      }
    };

    void load();
    const timer = setInterval(() => void load(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
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
        const incoming = data.agentMessage ? [data.message, data.agentMessage] : [data.message];
        const latest = incoming[incoming.length - 1];
        setSelected((current) => {
          if (!current || current.id !== selectedId) return current;
          const seen = new Set(current.messages.map((message) => message.id));
          return {
            ...current,
            latestMessage: latest,
            messages: [...current.messages, ...incoming.filter((message) => !seen.has(message.id))],
          };
        });
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
