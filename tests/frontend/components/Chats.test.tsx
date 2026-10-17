import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Chats from "@/ui/components/Chats";
import type { ChatSummary } from "@/ui/hooks/useChat";

const chat: ChatSummary = {
  id: "chat-1",
  kind: "DM",
  title: "Jordan",
  members: [],
  latestMessage: {
    id: "m1",
    body: "hey",
    createdAt: "2026-01-01T00:00:00.000Z",
    authorId: "jordan",
    authorName: "Jordan",
  },
};

describe("Chats", () => {
  it("shows an empty state", () => {
    render(<Chats chats={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("No chats yet")).toBeInTheDocument();
  });

  it("shows the latest message and selects the chat", () => {
    const onSelect = vi.fn();
    render(<Chats chats={[chat, { ...chat, id: "chat-2", title: "Alex", latestMessage: null }]} selectedId={null} onSelect={onSelect} />);

    expect(screen.getByText("hey")).toBeInTheDocument();
    expect(screen.getByText("No messages yet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Jordan/ }));
    expect(onSelect).toHaveBeenCalledWith("chat-1");
  });
});
