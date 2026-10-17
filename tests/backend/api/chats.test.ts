import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/services/chat/chat", () => ({
  chatService: {
    list: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    send: vi.fn(),
  },
}));

import { GET as listChats, POST as createChat } from "@/app/api/chats/route";
import { GET as getChat } from "@/app/api/chats/[id]/route";
import { POST as sendChat } from "@/app/api/chats/[id]/send/route";
import { chatService } from "@/backend/services/chat/chat";

const chats = vi.mocked(chatService);
const request = new Request("http://localhost/api/chats", { method: "POST" });
const message = {
  id: "message-1",
  body: "hello",
  createdAt: new Date("2026-01-01"),
  authorId: "me",
  authorName: "Sam",
};

describe("chat routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists chats or returns 401", async () => {
    chats.list.mockResolvedValueOnce({ ok: false, reason: "unauthorized" });
    expect((await listChats(request)).status).toBe(401);

    chats.list.mockResolvedValueOnce({ ok: true, chats: [] });
    const response = await listChats(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ chats: [] });
  });

  it("creates a chat with 201, an existing direct message with 200, and a bad body with 400", async () => {
    const chat = { id: "chat-1", title: "Jordan" };
    chats.create.mockResolvedValueOnce({ ok: true, chat: chat as never, created: true });
    expect((await createChat(request)).status).toBe(201);

    chats.create.mockResolvedValueOnce({ ok: true, chat: chat as never, created: false });
    expect((await createChat(request)).status).toBe(200);

    chats.create.mockResolvedValueOnce({ ok: false, reason: "invalid", error: "A group needs a name" });
    const invalid = await createChat(request);
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ error: "A group needs a name" });
  });

  it("gets a chat, or 401 and 404", async () => {
    const params = Promise.resolve({ id: "chat-1" });
    chats.get.mockResolvedValueOnce({ ok: false, reason: "unauthorized" });
    expect((await getChat(request, { params })).status).toBe(401);

    chats.get.mockResolvedValueOnce({ ok: false, reason: "not_found" });
    expect((await getChat(request, { params })).status).toBe(404);

    chats.get.mockResolvedValueOnce({ ok: true, chat: { id: "chat-1" } as never });
    const response = await getChat(request, { params });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ chat: { id: "chat-1" } });
  });

  it("sends a message and allows a quiet agent", async () => {
    chats.send.mockResolvedValue({
      ok: true,
      message,
      agentMessage: null,
    });
    const response = await sendChat(request, { params: Promise.resolve({ id: "chat-1" }) });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      message: { id: "message-1", body: "hello" },
      agentMessage: null,
    });
  });
});
