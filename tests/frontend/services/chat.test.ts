import { beforeEach, describe, expect, it, vi } from "vitest";
import { chatService } from "@/ui/services/chat";

const chat = {
  id: "chat-1",
  kind: "DM" as const,
  title: "Jordan",
  members: [],
  latestMessage: null,
  messages: [],
};
const message = {
  id: "message-1",
  body: "hello",
  createdAt: "2026-01-01T00:00:00.000Z",
  authorId: "me",
  authorName: "Sam",
};

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe("ChatService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("unwraps the list, the chat, and the send result", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ chats: [chat] }) as never)
      .mockResolvedValueOnce(jsonResponse({ chat }) as never)
      .mockResolvedValueOnce(jsonResponse({ chat }) as never)
      .mockResolvedValueOnce(jsonResponse({ message, agentMessage: null }) as never);

    await expect(chatService.list()).resolves.toEqual([chat]);
    await expect(chatService.get("chat-1")).resolves.toEqual(chat);
    await expect(chatService.create({ kind: "DM", usernames: ["jordan"] })).resolves.toEqual(chat);
    await expect(chatService.send("chat-1", "hello")).resolves.toEqual({ message, agentMessage: null });

    const urls = vi.mocked(fetch).mock.calls.map((call) => call[0]);
    expect(urls).toEqual(["/api/chats", "/api/chats/chat-1", "/api/chats", "/api/chats/chat-1/send"]);
  });
});
