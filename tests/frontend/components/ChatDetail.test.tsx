import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ChatDetail from "@/ui/components/ChatDetail";
import type { ChatDetail as ChatDetailData } from "@/ui/hooks/useChat";

const chat: ChatDetailData = {
  id: "chat-1",
  kind: "DM",
  title: "Jordan",
  members: [],
  latestMessage: null,
  messages: [],
};

function renderDetail(onSend: (body: string) => Promise<boolean>, current: ChatDetailData = chat) {
  return render(
    <ChatDetail
      chat={current}
      currentUserId="me"
      currentUserName="Sam"
      onBack={vi.fn()}
      onSend={onSend}
    />,
  );
}

describe("ChatDetail", () => {
  it("shows a grey message while sending and a black one after it is saved", async () => {
    let finish: (sent: boolean) => void = () => undefined;
    const onSend = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const view = renderDetail(onSend);

    fireEvent.change(screen.getByPlaceholderText("Message"), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.getByRole("button", { name: "Sending" })).toBeDisabled();
    expect(screen.getByText("hello").className).toContain("bg-zinc-300");

    const saved = {
      ...chat,
      messages: [
        {
          id: "m1",
          body: "hello",
          createdAt: "2026-01-01T00:00:00.000Z",
          authorId: "me",
          authorName: "Sam",
        },
      ],
    };
    view.rerender(
      <ChatDetail chat={saved} currentUserId="me" currentUserName="Sam" onBack={vi.fn()} onSend={onSend} />,
    );
    expect(screen.getByText("hello").className).toContain("bg-foreground");

    finish(true);
  });

  it("puts the text back when sending fails", async () => {
    const onSend = vi.fn(async () => false);
    renderDetail(onSend);

    fireEvent.change(screen.getByPlaceholderText("Message"), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("button", { name: "Send" })).toBeEnabled();
    expect(screen.getByPlaceholderText("Message")).toHaveValue("hello");
  });
});
