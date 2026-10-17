"use client";

import { useState } from "react";
import ChatDetail from "@/ui/components/ChatDetail";
import Chats from "@/ui/components/Chats";
import CreateChat from "@/ui/components/CreateChat";
import Memories from "@/ui/components/Memories";
import useChat from "@/ui/hooks/useChat";

export default function ChatPage() {
  const { user, loading, signOut, chats, selected, selectedId, selectChat, send, createChat, error } =
    useChat();
  const [showMemories, setShowMemories] = useState(false);

  if (loading || !user) {
    return <p className="px-6 py-16 text-sm text-zinc-500">Loading...</p>;
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/15">
        <span className="font-semibold">{user.username}</span>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setShowMemories(true)} className="text-sm underline">
            Memories
          </button>
          <button type="button" onClick={signOut} className="text-sm underline">
            Sign out
          </button>
        </div>
      </header>
      {showMemories ? (
        <Memories onClose={() => setShowMemories(false)} />
      ) : (
        <>
          {error ? <p className="px-4 py-2 text-sm text-red-600">{error}</p> : null}
          <div className="flex min-h-0 flex-1">
            <aside
              className={`${selectedId ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-black/10 md:w-80 md:border-r dark:border-white/15`}
            >
              <CreateChat currentUserId={user.id} onCreate={createChat} />
              <Chats chats={chats} selectedId={selectedId} onSelect={selectChat} />
            </aside>
            <section className={`${selectedId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
              {selectedId && selected?.id !== selectedId ? (
                <p className="px-6 py-16 text-sm text-zinc-500">Loading...</p>
              ) : (
                <ChatDetail
                  chat={selected}
                  currentUserId={user.id}
                  currentUserName={user.username ?? "You"}
                  onBack={() => selectChat(null)}
                  onSend={send}
                />
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
