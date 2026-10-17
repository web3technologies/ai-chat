export type MockMember = {
  id: string;
  name: string;
  kind: "HUMAN" | "AGENT";
};

export type MockMessage = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type MockChat = {
  id: string;
  kind: "DM" | "GROUP";
  title: string;
  members: MockMember[];
  messages: MockMessage[];
};

export const currentUserId = "me";

export const mockChats: MockChat[] = [
  {
    id: "dm-sam",
    kind: "DM",
    title: "Sam",
    members: [
      { id: currentUserId, name: "You", kind: "HUMAN" },
      { id: "sam", name: "Sam", kind: "HUMAN" },
      { id: "agent", name: "Agent", kind: "AGENT" },
    ],
    messages: [
      {
        id: "dm-1",
        authorId: "sam",
        body: "Are you free to look at the notes later?",
        createdAt: "2026-10-17T14:05:00.000Z",
      },
      {
        id: "dm-2",
        authorId: "agent",
        body: "Sam usually means after 4pm when they say later.",
        createdAt: "2026-10-17T14:05:20.000Z",
      },
      {
        id: "dm-3",
        authorId: currentUserId,
        body: "Yes, I can do after 4.",
        createdAt: "2026-10-17T14:12:00.000Z",
      },
    ],
  },
  {
    id: "group-project",
    kind: "GROUP",
    title: "Project",
    members: [
      { id: currentUserId, name: "You", kind: "HUMAN" },
      { id: "sam", name: "Sam", kind: "HUMAN" },
      { id: "jordan", name: "Jordan", kind: "HUMAN" },
      { id: "agent", name: "Agent", kind: "AGENT" },
    ],
    messages: [
      {
        id: "group-1",
        authorId: "jordan",
        body: "Can we move the review to tomorrow morning?",
        createdAt: "2026-10-17T15:00:00.000Z",
      },
      {
        id: "group-2",
        authorId: "sam",
        body: "Morning works for me.",
        createdAt: "2026-10-17T15:04:00.000Z",
      },
      {
        id: "group-3",
        authorId: "agent",
        body: "Tomorrow morning is open for everyone in this chat.",
        createdAt: "2026-10-17T15:04:30.000Z",
      },
    ],
  },
];
