export type MemoryView = {
    id: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
  };

export type ActiveFact = {
    id: string;
    userId: string;
    content: string;
    visibility: "PRIVATE" | "PARTICIPANTS";
    audienceIds: string[];
  };