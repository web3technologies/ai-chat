import type { AgentMemory, AgentMessage, RoomPerson } from "@/backend/services/agent/types";

const RECENT_TURNS = 8;

export class Conversation {
  readonly instructions =
    "The latest line is for Agent because it continues Agent's earlier turn. A line between the people, including an unaddressed question to the room, is not for Agent.";

  namesAgent(body: string) {
    return this.mentionsWord(body, "agent");
  }

  namesSomeoneElse(body: string, sender: RoomPerson, humans: RoomPerson[]) {
    const key = this.personKey(sender);
    return humans.some((person) => this.personKey(person) !== key && this.namesPerson(body, person));
  }

  oneHumanRecently(messages: AgentMessage[]) {
    const recent = new Set(
      messages
        .slice(-RECENT_TURNS)
        .flatMap((message) => (message.author.kind === "HUMAN" ? [this.personKey(message.author)] : [])),
    );
    return recent.size <= 1;
  }

  followsAgent(messages: AgentMessage[]) {
    return messages.at(-2)?.author.kind === "AGENT";
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
    return `People: ${people}\nPrevious speaker: ${speaker}\nTranscript:\n${transcript}\nLatest:\n${line}`;
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

  private namesPerson(body: string, person: RoomPerson) {
    return this.mentionsWord(body, person.name) || (person.username ? this.mentionsWord(body, person.username) : false);
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
