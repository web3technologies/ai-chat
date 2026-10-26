import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatRepository } from "@/backend/repositories/chat";
import { UserRepository } from "@/backend/repositories/user";
import { ChatService } from "@/backend/services/chat/chat";
import type { Agent } from "@/backend/services/agent/agent";
import type { AuthToken } from "@/backend/services/auth/token";

type Kind = "HUMAN" | "AGENT";

type StoredUser = { id: string; username: string; name: string; kind: Kind };

type StoredMessage = {
  id: string;
  chatId: string;
  body: string;
  createdAt: Date;
  authorId: string;
  author: { name: string; username: string; kind: Kind };
};

type StoredChat = {
  id: string;
  kind: "DM" | "GROUP";
  name: string | null;
  members: { userId: string; user: StoredUser }[];
  messages: StoredMessage[];
};

function request(body?: unknown, token = "signed") {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("ChatService", () => {
  const users = new Map<string, StoredUser>();
  const chats: StoredChat[] = [];
  let messageCount = 0;

  function member(userId: string) {
    const user = users.get(userId);
    if (!user) throw new Error(`missing ${userId}`);
    return { userId, user };
  }

  const db = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null),
      findMany: vi.fn(async ({ where }: { where: { username: { in: string[] }; kind: Kind } }) =>
        [...users.values()].filter(
          (user) => where.username.in.includes(user.username) && user.kind === where.kind,
        ),
      ),
    },
    chat: {
      findMany: vi.fn(async ({ where }: { where: { members: { some: { userId: string } } } }) =>
        chats
          .filter((chat) => chat.members.some((item) => item.userId === where.members.some.userId))
          .map((chat) => ({
            ...chat,
            messages: [...chat.messages].reverse().slice(0, 1),
          })),
      ),
      findFirst: vi.fn(async ({ where }: { where: { id?: string; kind?: string; members?: { some: { userId: string } } } }) => {
        if (where.id) {
          const chat = chats.find((item) => item.id === where.id) ?? null;
          const userId = where.members?.some.userId;
          if (!chat || (userId && !chat.members.some((item) => item.userId === userId))) return null;
          return chat;
        }
        if (where.kind === "DM") return chats.find((chat) => chat.kind === "DM") ?? null;
        return null;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const chat = chats.find((item) => item.id === where.id);
        if (!chat) return null;
        return {
          ...chat,
          members: chat.members.map((item) => ({ ...item, user: { ...item.user, memories: [] } })),
        };
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const chat = chats.find((item) => item.id === where.id);
        if (!chat) throw new Error("missing chat");
        return chat;
      }),
      create: vi.fn(async ({ data }: { data: { kind: "DM" | "GROUP"; name: string | null; members: { create: { userId: string }[] } } }) => {
        const chat: StoredChat = {
          id: `chat-${chats.length + 1}`,
          kind: data.kind,
          name: data.name,
          members: data.members.create.map((item) => member(item.userId)),
          messages: [],
        };
        chats.push(chat);
        return chat;
      }),
      update: vi.fn(async () => ({})),
    },
    chatMember: {
      findUnique: vi.fn(async ({ where }: { where: { chatId_userId: { chatId: string; userId: string } } }) => {
        const chat = chats.find((item) => item.id === where.chatId_userId.chatId);
        const belongs = chat?.members.some((item) => item.userId === where.chatId_userId.userId);
        return belongs ? where.chatId_userId : null;
      }),
      findMany: vi.fn(async ({ where }: { where: { chatId: string; user: { kind: Kind } } }) => {
        const chat = chats.find((item) => item.id === where.chatId);
        return (chat?.members ?? [])
          .filter((item) => item.user.kind === where.user.kind)
          .map((item) => ({ user: item.user }));
      }),
      create: vi.fn(async ({ data }: { data: { chatId: string; userId: string } }) => {
        chats.find((item) => item.id === data.chatId)?.members.push(member(data.userId));
        return data;
      }),
    },
    message: {
      create: vi.fn(async ({ data }: { data: { chatId: string; authorId: string; body: string } }) => {
        const author = users.get(data.authorId);
        const message: StoredMessage = {
          id: `message-${++messageCount}`,
          chatId: data.chatId,
          body: data.body,
          createdAt: new Date(),
          authorId: data.authorId,
          author: { name: author?.name ?? "Unknown", username: author?.username ?? "", kind: author?.kind ?? "HUMAN" },
        };
        chats.find((item) => item.id === data.chatId)?.messages.push(message);
        return message;
      }),
      findMany: vi.fn(async ({ where }: { where: { chatId: string } }) =>
        chats.find((item) => item.id === where.chatId)?.messages ?? [],
      ),
    },
    memory: {
      findMany: vi.fn(async () => []),
    },
    $transaction: vi.fn(async (run: (tx: unknown) => Promise<unknown>) => run(db)),
  };

  const tokens = { userIdFromRequest: vi.fn(async () => "me" as string | null) };
  const assistant = {
    user: vi.fn(async () => users.get("agent")),
    consider: vi.fn(async () => null as string | null),
    remember: vi.fn(async () => undefined),
  };
  const service = new ChatService(
    new ChatRepository(db as never),
    new UserRepository(db as never),
    tokens as unknown as AuthToken,
    assistant as unknown as Agent,
  );

  beforeEach(() => {
    users.clear();
    chats.splice(0, chats.length);
    messageCount = 0;
    users.set("me", { id: "me", username: "sam", name: "Sam", kind: "HUMAN" });
    users.set("jordan", { id: "jordan", username: "jordan", name: "Jordan", kind: "HUMAN" });
    users.set("alex", { id: "alex", username: "alex", name: "Alex", kind: "HUMAN" });
    users.set("agent", { id: "agent", username: "agent", name: "Agent", kind: "AGENT" });
    tokens.userIdFromRequest.mockResolvedValue("me");
    assistant.consider.mockResolvedValue(null);
    vi.clearAllMocks();
  });

  it("rejects a missing token", async () => {
    tokens.userIdFromRequest.mockResolvedValue(null);
    await expect(service.list(new Request("http://localhost"))).resolves.toEqual({ ok: false, reason: "unauthorized" });
    await expect(service.get(new Request("http://localhost"), "chat-1")).resolves.toEqual({
      ok: false,
      reason: "unauthorized",
    });
    await expect(service.send(request({ body: "hi" }), "chat-1")).resolves.toEqual({ ok: false, reason: "unauthorized" });
    await expect(service.create(request({ kind: "DM", usernames: ["jordan"] }))).resolves.toEqual({
      ok: false,
      reason: "unauthorized",
    });
  });

  it("hides a chat the caller is not in", async () => {
    chats.push({ id: "chat-1", kind: "DM", name: null, members: [member("jordan"), member("agent")], messages: [] });
    await expect(service.get(request(), "chat-1")).resolves.toEqual({ ok: false, reason: "not_found" });
    await expect(service.send(request({ body: "hi" }), "chat-1")).resolves.toEqual({ ok: false, reason: "not_found" });
  });

  it("rejects an empty message, a nameless group, and a bad direct message", async () => {
    await expect(service.send(request({ body: "  " }), "chat-1")).resolves.toMatchObject({
      ok: false,
      reason: "invalid",
    });
    await expect(service.send(request({ body: "a".repeat(2001) }), "chat-1")).resolves.toMatchObject({
      ok: false,
      reason: "invalid",
      error: "Message is too long",
    });
    await expect(service.create(request({ kind: "GROUP", usernames: ["jordan"] }))).resolves.toMatchObject({
      ok: false,
      reason: "invalid",
      error: "A group needs a name",
    });
    await expect(service.create(request({ kind: "DM", usernames: ["jordan", "alex"] }))).resolves.toMatchObject({
      ok: false,
      reason: "invalid",
      error: "A direct message can only include one other person",
    });
    await expect(service.create(request({ kind: "DM", usernames: [] }))).resolves.toMatchObject({
      ok: false,
      reason: "invalid",
    });
  });

  it("creates a chat that includes the agent", async () => {
    const result = await service.create(request({ kind: "GROUP", usernames: ["jordan"], name: "Dinner" }));
    expect(result.ok && result.created).toBe(true);
    if (!result.ok) return;
    expect(result.chat.members.map((person) => person.id).sort()).toEqual(["agent", "jordan", "me"]);
    expect(result.chat.title).toBe("Dinner");
  });

  it("returns an existing direct message and adds the agent when missing", async () => {
    chats.push({
      id: "chat-1",
      kind: "DM",
      name: null,
      members: [member("me"), member("jordan")],
      messages: [],
    });

    const result = await service.create(request({ kind: "DM", usernames: ["jordan"] }));

    expect(result.ok && result.created).toBe(false);
    if (!result.ok) return;
    expect(result.chat.members.map((person) => person.id)).toContain("agent");
    expect(result.chat.title).toBe("Jordan");
  });

  it("keeps an existing direct message that already has the agent", async () => {
    chats.push({
      id: "chat-1",
      kind: "DM",
      name: null,
      members: [member("me"), member("jordan"), member("agent")],
      messages: [],
    });

    const result = await service.create(request({ kind: "DM", usernames: ["jordan"] }));

    expect(result.ok && result.created).toBe(false);
    expect(db.chatMember.create).not.toHaveBeenCalled();
  });

  it("saves the human message and returns the agent reply", async () => {
    chats.push({
      id: "chat-1",
      kind: "DM",
      name: null,
      members: [member("me"), member("jordan"), member("agent")],
      messages: [],
    });
    assistant.consider.mockResolvedValue("68");

    const result = await service.send(request({ body: " what is 17 times 4 " }), "chat-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message.body).toBe("what is 17 times 4");
    expect(result.agentMessage?.body).toBe("68");
    expect(result.agentMessage?.authorName).toBe("Agent");
  });

  it("keeps the human message when the agent throws", async () => {
    chats.push({
      id: "chat-1",
      kind: "DM",
      name: null,
      members: [member("me"), member("agent")],
      messages: [],
    });
    assistant.consider.mockRejectedValue(new Error("down"));

    const result = await service.send(request({ body: "hello" }), "chat-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message.body).toBe("hello");
    expect(result.agentMessage).toBeNull();
  });
});
