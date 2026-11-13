import type { AgentMemory, AgentMessage, RoomPerson } from "@/backend/services/agent/types";

const RECENT_TURNS = 8;

export class Conversation {
  readonly instructions =
    "The latest line is asking Agent a question or making a request of Agent. A follow-up to Agent's previous answer counts, even when Agent is not named. A question aimed at another person does not.";

  namesAgent(body: string) {
    return this.mentionsWord(body, "agent");
  }

  decisionInput(messages: AgentMessage[], humans: RoomPerson[]) {
    const latest = messages.at(-1);
    const previous = messages.at(-2);
    const earlier = messages.slice(0, -1);
    const people = humans.map((person) => this.oneLine(person.name)).join(", ") || "None";
    const transcript = earlier.length
      ? earlier.map((message) => `${this.oneLine(message.author.name)}: ${this.oneLine(message.body)}`).join("\n")
      : "None";
    const speaker = previous ? this.oneLine(previous.author.name) : "None";
    const line = latest ? `${this.oneLine(latest.author.name)}: ${this.oneLine(latest.body)}` : "None";
    return `People: ${people}\nPrevious speaker: ${speaker}\n${this.recentSpeakers(messages)}\nTranscript:\n${transcript}\nLatest:\n${line}`;
  }

  hearable(memory: Pick<AgentMemory, "visibility" | "audience">, subjectId: string, humanIds: string[]) {
    if (memory.visibility === "PRIVATE") return humanIds.length === 1 && humanIds[0] === subjectId;
    const allowed = new Set(memory.audience.map((person) => person.userId));
    return humanIds.every((id) => allowed.has(id));
  }

  chatMessage(name: string, kind: "HUMAN" | "AGENT", body: string) {
    if (kind === "AGENT") return { role: "assistant" as const, content: body };
    return { role: "user" as const, content: `${this.oneLine(name)}: ${body}` };
  }

  oneLine(value: string) {
    const single = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
    return single || "Someone";
  }

  plainReply(value: unknown) {
    if (typeof value !== "string") return null;
    const reply = value.trim();
    if (!reply || reply.toLowerCase() === "null" || reply.startsWith("{") || reply.startsWith("[")) {
      return null;
    }
    return reply;
  }

  private recentSpeakers(messages: AgentMessage[]) {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const message of messages.slice(-RECENT_TURNS)) {
      if (message.author.kind !== "HUMAN") continue;
      const key = this.personKey(message.author);
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(this.oneLine(message.author.name));
    }
    if (names.length <= 1) return `Only ${names[0] ?? "one person"} has spoken recently.`;
    return `Recent human speakers: ${names.join(", ")}.`;
  }

  private mentionsWord(body: string, word: string) {
    const token = word.trim();
    if (!token) return false;
    return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(body);
  }

  private personKey(person: RoomPerson) {
    return (person.username ?? person.name).trim().toLowerCase();
  }
}

export const conversation = new Conversation();
