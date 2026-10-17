"use client";

import ChatDetail from "@/ui/components/ChatDetail";
import Chats from "@/ui/components/Chats";
import useChat from "@/ui/hooks/useChat";

export default function ChatPage() {
  const { user, loading, signOut, chats, selected, selectedId, setSelectedId, send } = useChat();

  if (loading || !user) {
    return <p className="px-6 py-16 text-sm text-zinc-500">Loading...</p>;
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/15">
        <span className="font-semibold">{user.username}</span>
        <button type="button" onClick={signOut} className="text-sm underline">
          Sign out
        </button>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside
          className={`${selected ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-black/10 md:w-80 md:border-r dark:border-white/15`}
        >
          <Chats chats={chats} selectedId={selectedId} onSelect={setSelectedId} />
        </aside>
        <section className={`${selected ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
          <ChatDetail
            chat={selected}
            currentUserName={user.username ?? "You"}
            onBack={() => setSelectedId(null)}
            onSend={send}
          />
        </section>
      </div>
    </div>
  );
}
