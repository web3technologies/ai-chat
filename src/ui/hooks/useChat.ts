"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/ui/context/auth";
import { TOKEN_KEY } from "@/ui/services/client";
import { chatService, type ChatDetail, type ChatMessage, type ChatSummary, type CreateChatInput } from "@/ui/services/chat";

export type { ChatDetail, ChatMember, ChatMessage, ChatSummary, CreateChatInput } from "@/ui/services/chat";

export default function useChat() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const params = useParams<{ id?: string[] }>();
  const selectedId = params.id?.[0] ?? null;
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [selected, setSelected] = useState<ChatDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routeId, setRouteId] = useState(selectedId);
  if (routeId !== selectedId) {
    setRouteId(selectedId);
    if (!selectedId) setSelected(null);
  }

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
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  const socketRef = useRef<WebSocket | null>(null);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    if (!selectedId) return;
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "watch", chatId: selectedId }));
    }
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
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (loading || !user) return;
    let stopped = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const loadList = async () => {
      try {
        const next = await chatService.list();
        if (!stopped) setChats(next);
      } catch (cause: unknown) {
        if (!stopped) setError(cause instanceof Error ? cause.message : "Request failed");
      }
    };

    const loadOpen = async (id: string) => {
      try {
        const chat = await chatService.get(id);
        if (stopped) return;
        setSelected((current) => {
          if (current?.id === chat.id && current.messages.length > chat.messages.length) return current;
          return chat;
        });
      } catch (cause: unknown) {
        if (!stopped) setError(cause instanceof Error ? cause.message : "Request failed");
      }
    };

    const receive = (chatId: string, message: ChatMessage) => {
      setSelected((current) => {
        if (!current || current.id !== chatId) return current;
        if (current.messages.some((item) => item.id === message.id)) return current;
        return { ...current, latestMessage: message, messages: [...current.messages, message] };
      });
      let missing = false;
      setChats((current) => {
        const index = current.findIndex((chat) => chat.id === chatId);
        if (index < 0) {
          missing = true;
          return current;
        }
        const next = current.map((chat) => (chat.id === chatId ? { ...chat, latestMessage: message } : chat));
        if (index === 0) return next;
        const [chat] = next.splice(index, 1);
        return [chat, ...next];
      });
      if (missing) void loadList();
    };

    const connect = () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token || stopped) return;
      socket = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001");
      socketRef.current = socket;
      socket.addEventListener("open", () => {
        socket?.send(JSON.stringify({ type: "auth", token }));
        const open = selectedIdRef.current;
        if (open) socket?.send(JSON.stringify({ type: "watch", chatId: open }));
      });
      socket.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(String(event.data)) as { type?: string; chatId?: string; message?: ChatMessage };
          if (data.type !== "message" || !data.chatId || !data.message) return;
          receive(data.chatId, data.message);
        } catch {
          // Ignore a frame that is not a chat message.
        }
      });
      socket.addEventListener("close", () => {
        if (stopped) return;
        reconnectTimer = setTimeout(() => {
          void loadList();
          const open = selectedIdRef.current;
          if (open) void loadOpen(open);
          connect();
        }, 1000);
      });
    };

    connect();
    return () => {
      stopped = true;
      socketRef.current = null;
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [loading, user]);

  const selectChat = useCallback(
    (id: string | null) => {
      if (!id) {
        setSelected(null);
        router.push("/chat");
        return;
      }
      router.push(`/chat/${id}`);
    },
    [router],
  );

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
    router.push(`/chat/${chat.id}`);
  }, [router]);

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
