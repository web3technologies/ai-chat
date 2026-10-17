"use client";

import useCreateChat from "@/ui/hooks/useCreateChat";
import type { CreateChatInput } from "@/ui/hooks/useChat";

export default function CreateChat({
  currentUserId,
  onCreate,
}: {
  currentUserId: string;
  onCreate: (input: CreateChatInput) => Promise<void>;
}) {
  const { open, setOpen, people, selected, name, setName, error, submitting, toggle, submit } =
    useCreateChat(currentUserId, onCreate);

  if (!open) {
    return (
      <div className="border-b border-black/10 p-3 dark:border-white/15">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-10 w-full rounded-full bg-foreground px-4 text-background"
        >
          Create
        </button>
      </div>
    );
  }

  const needsName = selected.length > 1;

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3 border-b border-black/10 p-3 dark:border-white/15">
      <div className="flex items-center justify-between">
        <span className="font-medium">New chat</span>
        <button type="button" onClick={() => setOpen(false)} className="text-sm underline">
          Cancel
        </button>
      </div>
      <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
        {people.map((person) => (
          <li key={person.id}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(person.username ?? "")}
                onChange={() => person.username && toggle(person.username)}
              />
              <span>{person.name}</span>
              <span className="text-zinc-500">@{person.username}</span>
            </label>
          </li>
        ))}
      </ul>
      {needsName ? (
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Group name"
          className="h-10 rounded-md border border-black/10 bg-transparent px-3 dark:border-white/15"
          required
        />
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        className="h-10 rounded-full bg-foreground px-4 text-background disabled:opacity-60"
        disabled={submitting || selected.length === 0 || (needsName && !name.trim())}
      >
        Create
      </button>
    </form>
  );
}
