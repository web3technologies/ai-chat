import "server-only";
import OpenAI from "openai";
import { MEMORY_MAX } from "@/backend/limits";
import { memoryRepository, type MemoryRepository } from "@/backend/repositories/memory";
import { userRepository, type UserRepository } from "@/backend/repositories/user";
import { instructions, memoryInstructions } from "@/backend/services/agent/prompt";
import type { AgentMember, AgentMessage } from "@/backend/services/agent/types";


export class Agent {
  constructor(
    private readonly users: UserRepository,
    private readonly memories: MemoryRepository,
  ) {}

  user() {
    return this.users.ensureAgent();
  }

  async consider(messages: AgentMessage[], members: AgentMember[]): Promise<string | null> {
    if (!process.env.OPENAI_API_KEY) {
      console.log("[agent] skipped: OPENAI_API_KEY is not set");
      return null;
    }

    const latest = messages.at(-1);
    if (!latest || latest.author.kind !== "HUMAN" || !/\bagent\b/i.test(latest.body)) {
      console.log("[agent] decision: stay quiet, not addressed");
      return null;
    }

    const humanIds = members.flatMap((member) => (member.user.kind === "HUMAN" ? [member.user.id] : []));
    const memories = members.flatMap((member) =>
      member.user.kind === "HUMAN"
        ? member.user.memories
            .filter((memory) => hearable(memory, member.user.id, humanIds))
            .map((memory) => ({ name: member.user.name, content: memory.content }))
        : [],
    );

    console.log(`[agent] considering ${messages.length} messages`);
    for (const memory of memories) {
      console.log(`[agent] memory ${memory.name}: ${memory.content}`);
    }
    for (const message of messages) {
      console.log(`[agent] ${message.author.name} (${message.author.kind}): ${message.body}`);
    }

    const facts = memories.length
      ? memories.map((memory) => `- ${oneLine(memory.name)}: ${oneLine(memory.content)}`).join("\n")
      : "None";

    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.chat.completions.create({
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
                reply: { type: ["string", "null"] },
              },
              required: ["reply"],
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.log("[agent] decision: stay quiet, empty response");
        return null;
      }
      const parsed = JSON.parse(content) as { reply?: unknown };
      const reply = plainReply(parsed.reply);
      console.log("parsed", parsed);
      if (!reply) {
        console.log("[agent] decision: stay quiet");
        return null;
      }
      console.log(`[agent] decision: reply: ${reply}`);
      return reply;
    } catch (error) {
      console.error("[agent] request failed", error);
      return null;
    }
  }

  async remember(members: AgentMember[], messages: AgentMessage[]) {
    if (!process.env.OPENAI_API_KEY) return;

    const humans = members.map((member) => member.user).filter((person) => person.kind === "HUMAN" && person.username);
    if (humans.length === 0) return;

    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: memoryInstructions },
          {
            role: "user",
            content: `Quoted people:\n${humans
              .map((person) => `${oneLine(person.name)} (${oneLine(person.username ?? "")})`)
              .join("\n")}`,
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
            name: "agent_memories",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                memories: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      username: { type: "string" },
                      content: { type: "string" },
                    },
                    required: ["username", "content"],
                  },
                },
              },
              required: ["memories"],
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.log("[agent] memory: nothing new");
        return;
      }

      const parsed = JSON.parse(content) as { memories?: { username?: unknown; content?: unknown }[] };
      const humanIds = humans.map((person) => person.id);
      const visibility = humanIds.length === 1 ? "PRIVATE" : "PARTICIPANTS";
      const existing = await this.memories.listForUsers(humanIds);
      const known = new Set(
        existing.map((memory) =>
          memoryKey(
            memory.userId,
            memory.content,
            memory.visibility,
            memory.audience.map((person) => person.userId),
          ),
        ),
      );
      let stored = 0;

      for (const memory of parsed.memories ?? []) {
        if (typeof memory.username !== "string" || typeof memory.content !== "string") continue;
        const contentText = memory.content.trim();
        if (!contentText || contentText.length > MEMORY_MAX) continue;
        const person = humans.find(
          (candidate) => candidate.username?.toLowerCase() === memory.username?.toString().toLowerCase(),
        );
        if (!person) continue;
        const key = memoryKey(person.id, contentText, visibility, humanIds);
        if (known.has(key)) continue;
        known.add(key);
        await this.memories.create(person.id, contentText, visibility, humanIds);
        stored += 1;
        console.log(`[agent] memory: ${person.name}: ${contentText}`);
      }

      if (stored === 0) console.log("[agent] memory: nothing new");
    } catch (error) {
      console.error("[agent] memory request failed", error);
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

function memoryKey(userId: string, content: string, visibility: string, audienceIds: string[]) {
  return `${userId}:${visibility}:${[...audienceIds].sort().join(",")}:${content.trim().toLowerCase()}`;
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

export const agent = new Agent(userRepository, memoryRepository);
