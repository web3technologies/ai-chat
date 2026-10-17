import type { Prisma } from "@/backend/db/prisma/generated/client";

export type ChatMemberView = {
  id: string;
  username: string | null;
  name: string;
  kind: "HUMAN" | "AGENT";
};

export type ChatMessageView = {
  id: string;
  body: string;
  createdAt: Date;
  authorId: string;
  authorName: string;
};

export type ChatSummary = {
  id: string;
  kind: "DM" | "GROUP";
  title: string;
  members: ChatMemberView[];
  latestMessage: ChatMessageView | null;
};

export type ChatDetail = ChatSummary & {
  messages: ChatMessageView[];
};

export type ChatFailure =
  | { ok: false; reason: "unauthorized" }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid"; error: string };

export type MemberRow = {
  userId: string;
  user: ChatMemberView;
};

export type MessageRow = {
  id: string;
  body: string;
  createdAt: Date;
  authorId: string;
  author: { name: string };
};

export type ChatRow = {
  id: string;
  kind: "DM" | "GROUP";
  name: string | null;
  members: MemberRow[];
  messages: MessageRow[];
};

export function chatKind(value: unknown): "DM" | "GROUP" | null {
  if (value === "DM" || value === "GROUP") return value;
  return null;
}

const memberSelect = {
  id: true,
  username: true,
  name: true,
  kind: true,
} as const;

export const detailInclude = {
  members: {
    include: { user: { select: memberSelect } },
    orderBy: { joinedAt: "asc" as const },
  },
  messages: {
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.ChatInclude;
