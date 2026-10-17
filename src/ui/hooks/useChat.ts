"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/ui/context/auth";
import { currentUserId, mockChats, type MockChat } from "@/ui/mock/chats";

export default function useChat() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [chats, setChats] = useState<MockChat[]>(mockChats);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  const selected = chats.find((chat) => chat.id === selectedId) ?? null;

  const send = useCallback(
    (body: string) => {
      if (!selectedId) return;
      setChats((current) =>
        current.map((chat) =>
          chat.id === selectedId
            ? {
                ...chat,
                messages: [
                  ...chat.messages,
                  {
                    id: crypto.randomUUID(),
                    authorId: currentUserId,
                    body,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : chat,
        ),
      );
    },
    [selectedId],
  );

  return { user, loading, signOut, chats, selected, selectedId, setSelectedId, send };
}
