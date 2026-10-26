export type AgentAuthor = {
  name: string;
  username: string | null;
  kind: "HUMAN" | "AGENT";
};

export type AgentMessage = {
  body: string;
  author: AgentAuthor;
};

export type AgentMember = {
  user: AgentAuthor & {
    id: string;
    memories: { content: string }[];
  };
};
