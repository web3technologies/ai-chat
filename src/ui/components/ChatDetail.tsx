"use client";

import { FormEvent, useLayoutEffect, useRef, useState } from "react";
import type { ChatDetail as ChatDetailData } from "@/ui/hooks/useChat";

export default function ChatDetail({
  chat,
  currentUserId,
  currentUserName,
  onBack,
  onSend,
}: {
  chat: ChatDetailData | null;
  currentUserId: string;
  currentUserName: string;
  onBack: () => void;
  onSend: (body: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const chatId = chat?.id;
  const lastMessageId = chat?.messages.at(-1)?.id;

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [chatId, lastMessageId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !chat) return;
    const sent = await onSend(body);
    if (sent) setDraft("");
  }

  if (!chat) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        Select a chat
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-start gap-3 border-b border-black/10 px-4 py-3 dark:border-white/15">
        <button type="button" onClick={onBack} className="text-sm underline md:hidden">
          Back
        </button>
        <div className="min-w-0">
          <h1 className="font-semibold">{chat.title}</h1>
          <p className="truncate text-sm text-zinc-500">
            {chat.members
              .map((member) =>
                member.kind === "AGENT"
                  ? "Agent"
                  : member.id === currentUserId
                    ? currentUserName
                    : member.name,
              )
              .join(", ")}
          </p>
        </div>
      </header>
      <ol ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {chat.messages.map((message) => {
          const author = chat.members.find((member) => member.id === message.authorId);
          const mine = message.authorId === currentUserId;
          const name =
            author?.kind === "AGENT" ? "Agent" : mine ? currentUserName : message.authorName;
          return (
            <li key={message.id} className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
              <span className="text-xs text-zinc-500">{name}</span>
              <p
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  mine ? "bg-foreground text-background" : "bg-black/5 dark:bg-white/10"
                }`}
              >
                {message.body}
              </p>
            </li>
          );
        })}
      </ol>
      <form onSubmit={(event) => void submit(event)} className="flex gap-2 border-t border-black/10 p-3 dark:border-white/15">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message"
          className="h-10 min-w-0 flex-1 rounded-md border border-black/10 bg-transparent px-3 dark:border-white/15"
        />
        <button
          type="submit"
          className="h-10 rounded-full bg-foreground px-4 text-background disabled:opacity-60"
          disabled={!draft.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}
