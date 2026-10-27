export type AgentAuthor = {
  name: string;
  username: string | null;
  kind: "HUMAN" | "AGENT";
};

export type AgentMessage = {
  body: string;
  author: AgentAuthor;
};

export type AgentMemory = {
  content: string;
  visibility: "PRIVATE" | "PARTICIPANTS";
  audience: { userId: string }[];
};

export type AgentMember = {
  user: AgentAuthor & {
    id: string;
    memories: AgentMemory[];
  };
};
