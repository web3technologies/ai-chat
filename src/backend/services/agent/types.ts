export type KnownFact = {
  name: string;
  content: string;
};

export type ChatPerson = {
  id: string;
  username: string | null;
  name: string;
};

export type RememberTurn = {
  username: string | null;
  name: string;
  kind: "HUMAN" | "AGENT";
  body: string;
};

export type TranscriptTurn = {
  authorName: string;
  kind: "HUMAN" | "AGENT";
  body: string;
};
