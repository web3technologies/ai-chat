import type { ChatSummary } from "@/ui/hooks/useChat";

export default function Chats({
  chats,
  selectedId,
  onSelect,
}: {
  chats: ChatSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (chats.length === 0) {
    return <p className="px-4 py-6 text-sm text-zinc-500">No chats yet</p>;
  }

  return (
    <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {chats.map((chat) => {
        const selected = chat.id === selectedId;
        return (
          <li key={chat.id}>
            <button
              type="button"
              onClick={() => onSelect(chat.id)}
              className={`flex w-full flex-col gap-1 px-4 py-3 text-left ${
                selected ? "bg-black/5 dark:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{chat.title}</span>
                <span className="text-xs uppercase tracking-wide text-zinc-500">{chat.kind}</span>
              </span>
              <span className="truncate text-sm text-zinc-500">
                {chat.latestMessage?.body ?? "No messages yet"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
