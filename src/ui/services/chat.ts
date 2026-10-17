"use client";

import { api } from "@/ui/services/client";

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

class ChatService {
  async list() {
    const data = await api<{ chats: ChatSummary[] }>("/api/chats");
    return data.chats;
  }

  async get(id: string) {
    const data = await api<{ chat: ChatDetail }>(`/api/chats/${id}`);
    return data.chat;
  }

  async create(input: CreateChatInput) {
    const data = await api<{ chat: ChatDetail }>("/api/chats", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return data.chat;
  }

  async send(id: string, body: string) {
    return api<{ message: ChatMessage; agentMessage: ChatMessage | null }>(`/api/chats/${id}/send`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  }
}

export const chatService = new ChatService();
