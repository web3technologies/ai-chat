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
        <ul className="min-h-0 flex-1 divide-y divide-black/10 overflow-y-auto dark:divide-white/15">
          {memories.map((memory) => (
            <MemoryRow key={memory.id} content={memory.content} onSave={(content) => update(memory.id, content)} onDelete={() => remove(memory.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function fit(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "0px";
  element.style.height = `${element.scrollHeight}px`;
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

  const dirty = draft.trim() !== content && draft.trim().length > 0;

  return (
    <li className="flex items-start gap-3 px-4 py-2">
      <textarea
        value={draft}
        rows={1}
        onChange={(event) => {
          setDraft(event.target.value);
          fit(event.target);
        }}
        ref={fit}
        className="max-h-24 min-h-8 flex-1 resize-none overflow-y-auto bg-transparent py-1.5 text-sm leading-5 outline-none"
      />
      <div className="flex h-8 shrink-0 items-center gap-3">
        <button type="button" onClick={() => void onDelete()} className="text-sm text-zinc-500 underline">
          Delete
        </button>
        {dirty ? (
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="h-8 rounded-full bg-foreground px-3 text-sm text-background disabled:opacity-60"
          >
            Save
          </button>
        ) : null}
      </div>
    </li>
  );
}
