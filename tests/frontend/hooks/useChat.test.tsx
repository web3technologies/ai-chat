import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatDetail, ChatMessage } from "@/ui/services/chat";

const router = { push: vi.fn(), replace: vi.fn() };
let params: { id?: string[] } = { id: ["chat-1"] };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => params,
}));

vi.mock("@/ui/context/auth", () => ({
  useAuth: () => ({
    user: { id: "me", username: "sam", name: "Sam", kind: "HUMAN" },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/ui/services/chat", () => ({
  chatService: {
    list: vi.fn(),
    get: vi.fn(),
    send: vi.fn(),
    create: vi.fn(),
  },
}));

import useChat from "@/ui/hooks/useChat";
import { chatService } from "@/ui/services/chat";

function message(id: string, body: string): ChatMessage {
  return { id, body, createdAt: "2026-01-01T00:00:00.000Z", authorId: "me", authorName: "Sam" };
}

function detail(messages: ChatMessage[]): ChatDetail {
  return {
    id: "chat-1",
    kind: "DM",
    title: "Jordan",
    members: [],
    latestMessage: messages.at(-1) ?? null,
    messages,
  };
}

describe("useChat", () => {
  beforeEach(() => {
    params = { id: ["chat-1"] };
    vi.clearAllMocks();
    vi.mocked(chatService.list).mockResolvedValue([]);
    vi.mocked(chatService.get).mockResolvedValue(detail([]));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the selected chat from the route and navigates when it changes", async () => {
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.selectedId).toBe("chat-1"));

    act(() => result.current.selectChat("chat-2"));
    expect(router.push).toHaveBeenCalledWith("/chat/chat-2");

    act(() => result.current.selectChat(null));
    expect(router.push).toHaveBeenCalledWith("/chat");
  });

  it("does not append a message that is already in the chat", async () => {
    const existing = message("m1", "hello");
    vi.mocked(chatService.get).mockResolvedValue(detail([existing]));
    vi.mocked(chatService.send).mockResolvedValue({ message: existing, agentMessage: null });
    const { result } = renderHook(() => useChat());

    await waitFor(() => expect(result.current.selected?.messages).toHaveLength(1));
    await act(async () => {
      await result.current.send("hello");
    });
    expect(result.current.selected?.messages).toEqual([existing]);
  });

  it("keeps a longer transcript when a poll comes back short", async () => {
    const polls: Array<() => void> = [];
    const realInterval = global.setInterval.bind(global);
    const interval = vi.spyOn(global, "setInterval").mockImplementation((handler, timeout, ...args) => {
      if (timeout === 2000) polls.push(handler as () => void);
      return realInterval(handler, timeout, ...args);
    });
    try {
      const first = message("m1", "hello");
      const second = message("m2", "again");
      vi.mocked(chatService.get).mockResolvedValueOnce(detail([first, second])).mockResolvedValue(detail([first]));
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.selected?.messages).toHaveLength(2));
      polls.forEach((poll) => poll());
      await waitFor(() => expect(vi.mocked(chatService.get).mock.calls.length).toBeGreaterThan(1));
      expect(result.current.selected?.messages).toHaveLength(2);
    } finally {
      interval.mockRestore();
    }
  });

  it("returns false and records an error when send fails", async () => {
    vi.mocked(chatService.get).mockResolvedValue(detail([]));
    vi.mocked(chatService.send).mockRejectedValue(new Error("nope"));
    const { result } = renderHook(() => useChat());

    await waitFor(() => expect(result.current.selected).not.toBeNull());
    await act(async () => {
      await expect(result.current.send("hello")).resolves.toBe(false);
    });
    expect(result.current.error).toBe("nope");
  });
});
