import "server-only";
import OpenAI from "openai";
import { userRepository, type UserRepository } from "@/backend/repositories/user";
import { instructions, memoryInstructions } from "@/backend/services/agent/prompt";
import type { AgentMember, AgentMessage } from "@/backend/services/agent/types";


export type MemoryFact = { id: string; username: string; content: string };

export type MemoryOperation = { op?: unknown; id?: unknown; username?: unknown; content?: unknown };

export class Agent {
  private aiClient: OpenAI | null = null;

  constructor(private readonly users: UserRepository) {}

  user() {
    return this.users.ensureAgent();
  }

  private client(): OpenAI | null {
    if (!process.env.OPENAI_API_KEY) {
      console.log("[agent] skipped: OPENAI_API_KEY is not set");
      return null;
    }
    this.aiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return this.aiClient;
  }

  async consider(messages: AgentMessage[]): Promise<boolean> {

    // get latest message
    const latest = messages.at(-1);
    // if latest message is the ai agent immediately return false
    if (!latest || latest.author.kind !== "HUMAN") return false;
    const ai = this.client();
    if (!ai) return false;
    try {
      const decision = await ai.decisions.create({
        model: "gpt-6-luna",
        input: messages.map((message) => `${oneLine(message.author.name)}: ${oneLine(message.body)}`).join("\n"),
        questions: [
          {
            type: "predicate",
            name: "should_reply",
            instructions:
              "The latest message is for the agent named Agent. Count a question or request that names the agent, and a follow-up to the agent's previous message, such as a correction, a confirmation, or try again, even when the name is absent. People talking only to each other are not for the agent.",
          },
        ],
      });
      const answer = decision.answers[0];
      if (!answer || answer.type !== "predicate") {
        console.log("[agent] decision: stay quiet");
        return false;
      }
      const shouldReply = answer.probability >= 0.7;
      console.log(`[agent] decision: ${shouldReply ? "reply" : "stay quiet"} (${answer.probability})`);
      return shouldReply;
    } catch (error) {
      console.error("[agent] decision failed", error);
      return false;
    }
  }

  async reply(messages: AgentMessage[], members: AgentMember[]): Promise<string | null> {

    const humanIds = members.flatMap((member) => (member.user.kind === "HUMAN" ? [member.user.id] : []));
    const memories = members.flatMap((member) =>
      member.user.kind === "HUMAN"
        ? member.user.memories
            .filter((memory) => hearable(memory, member.user.id, humanIds))
            .map((memory) => ({ name: member.user.name, content: memory.content }))
        : [],
    );

    console.log(`[agent] replying to ${messages.length} messages`);
    for (const memory of memories) {
      console.log(`[agent] memory ${memory.name}: ${memory.content}`);
    }
    for (const message of messages) {
      console.log(`[agent] ${message.author.name} (${message.author.kind}): ${message.body}`);
    }

    const facts = memories.length
      ? memories.map((memory) => `- ${oneLine(memory.name)}: ${oneLine(memory.content)}`).join("\n")
      : "None";

    const ai = this.client();
    if (!ai) return null;

    try {
      const response = await ai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: instructions },
          { role: "user", content: `Quoted facts:\n${facts}` },
          ...messages.map((message) => chatMessage(message.author.name, message.author.kind, message.body)),
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "agent_reply",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                reply: { type: "string" },
              },
              required: ["reply"],
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.log("[agent] reply: empty response");
        return null;
      }
      const parsed = JSON.parse(content) as { reply?: unknown };
      const reply = plainReply(parsed.reply);
      if (!reply) {
        console.log("[agent] reply: empty");
        return null;
      }
      console.log(`[agent] reply: ${reply}`);
      return reply;
    } catch (error) {
      console.error("[agent] request failed", error);
      return null;
    }
  }

  async remember(members: AgentMember[], messages: AgentMessage[], facts: MemoryFact[] = []): Promise<MemoryOperation[]> {
    const ai = this.client();
    if (!ai) return [];

    const humans = members.map((member) => member.user).filter((person) => person.kind === "HUMAN" && person.username);
    if (humans.length === 0) return [];

    const knownFacts = facts.map((fact) => `${fact.id} ${fact.username}: ${oneLine(fact.content)}`);

    try {
      const response = await ai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: memoryInstructions },
          {
            role: "user",
            content: `Quoted people:\n${humans
              .map((person) => `${oneLine(person.name)} (${oneLine(person.username ?? "")})`)
              .join("\n")}\n\nKnown facts:\n${knownFacts.length ? knownFacts.join("\n") : "None"}`,
          },
          ...messages.map((message) =>
            chatMessage(
              message.author.username ? `${message.author.name} (${message.author.username})` : message.author.name,
              message.author.kind,
              message.body,
            ),
          ),
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "agent_memory_operations",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                operations: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      op: { type: "string", enum: ["add", "replace", "delete"] },
                      id: { type: "string" },
                      username: { type: "string" },
                      content: { type: "string" },
                    },
                    required: ["op", "id", "username", "content"],
                  },
                },
              },
              required: ["operations"],
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      const parsed = JSON.parse(content) as { operations?: MemoryOperation[] };
      return parsed.operations ?? [];
    } catch (error) {
      console.error("[agent] memory request failed", error);
      throw error;
    }
  }
}

function hearable(
  memory: { visibility: "PRIVATE" | "PARTICIPANTS"; audience: { userId: string }[] },
  subjectId: string,
  humanIds: string[],
) {
  if (memory.visibility === "PRIVATE") return humanIds.length === 1 && humanIds[0] === subjectId;
  const allowed = new Set(memory.audience.map((person) => person.userId));
  return humanIds.every((id) => allowed.has(id));
}

function chatMessage(name: string, kind: "HUMAN" | "AGENT", body: string) {
  if (kind === "AGENT") return { role: "assistant" as const, content: body };
  return { role: "user" as const, content: `${oneLine(name)}: ${body}` };
}

function oneLine(value: string) {
  const single = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  return single || "Someone";
}

function plainReply(value: unknown) {
  if (typeof value !== "string") return null;
  const reply = value.trim();
  if (!reply || reply.toLowerCase() === "null" || reply.startsWith("{") || reply.startsWith("[")) {
    return null;
  }
  return reply;
}

export const agent = new Agent(userRepository);
