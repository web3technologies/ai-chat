"use client";

import { useState } from "react";
import useMemories from "@/ui/hooks/useMemories";

export default function Memories({ onClose }: { onClose: () => void }) {
  const { memories, loading, error, update, remove } = useMemories();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/15">
        <h1 className="font-semibold">Memories</h1>
        <button type="button" onClick={onClose} className="text-sm underline">
          Back
        </button>
      </div>
      {error ? <p className="px-4 py-2 text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <p className="px-4 py-6 text-sm text-zinc-500">Loading...</p>
      ) : memories.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-500">No memories yet</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          {memories.map((memory) => (
            <MemoryRow key={memory.id} content={memory.content} onSave={(content) => update(memory.id, content)} onDelete={() => remove(memory.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MemoryRow({
  content,
  onSave,
  onDelete,
}: {
  content: string;
  onSave: (content: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(content);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const saved = await onSave(draft);
    setSaving(false);
    if (!saved) setDraft(content);
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border border-black/10 p-3 dark:border-white/15">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={3}
        className="w-full resize-none rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/15"
      />
      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => void onDelete()} className="text-sm underline">
          Delete
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !draft.trim() || draft.trim() === content}
          className="h-9 rounded-full bg-foreground px-4 text-sm text-background disabled:opacity-60"
        >
          Save
        </button>
      </div>
    </li>
  );
}
