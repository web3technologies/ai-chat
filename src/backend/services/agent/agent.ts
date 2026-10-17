import "server-only";
import OpenAI from "openai";
import prisma from "@/backend/db/prisma/client";
import { instructions, memoryInstructions } from "@/backend/services/agent/prompt";
import type { ChatPerson, KnownFact, RememberTurn, TranscriptTurn } from "@/backend/services/agent/types";


export class Agent {
  constructor(private readonly db: typeof prisma) {}

  async user() {
    return this.db.user.upsert({
      where: { username: "agent" },
      update: { name: "Agent", kind: "AGENT" },
      create: { username: "agent", name: "Agent", kind: "AGENT" },
    });
  }

  async consider(transcript: TranscriptTurn[], memories: KnownFact[]): Promise<string | null> {
    if (!process.env.OPENAI_API_KEY) {
      console.log("[agent] skipped: OPENAI_API_KEY is not set");
      return null;
    }

    const latest = transcript.at(-1);
    if (!latest || latest.kind !== "HUMAN" || !/\bagent\b/i.test(latest.body)) {
      console.log("[agent] decision: stay quiet, not addressed");
      return null;
    }

    console.log(`[agent] considering ${transcript.length} messages`);
    for (const memory of memories) {
      console.log(`[agent] memory ${memory.name}: ${memory.content}`);
    }
    for (const turn of transcript) {
      console.log(`[agent] ${turn.authorName} (${turn.kind}): ${turn.body}`);
    }

    const facts = memories.length
      ? memories.map((memory) => `- ${memory.name}: ${memory.content}`).join("\n")
      : "None";

    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: instructions },
          {
            role: "user",
            content: `Known facts:\n${facts}\n\nTranscript:\n${transcript
              .map((turn) => `${turn.authorName} (${turn.kind}): ${turn.body}`)
              .join("\n")}`,
          },
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

  async remember(people: ChatPerson[], transcript: RememberTurn[]) {
    if (!process.env.OPENAI_API_KEY) return;

    const humans = people.filter((person) => person.username);
    if (humans.length === 0) return;

    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: memoryInstructions },
          {
            role: "user",
            content: `People:\n${humans.map((person) => `${person.name} (${person.username})`).join("\n")}\n\nTranscript:\n${transcript
              .map((turn) => `${turn.name} (${turn.username ?? turn.kind}): ${turn.body}`)
              .join("\n")}`,
          },
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
      const existing = await this.db.memory.findMany({
        where: { userId: { in: humans.map((person) => person.id) } },
        select: { userId: true, content: true },
      });
      const known = new Set(existing.map((memory) => `${memory.userId}:${memory.content.trim().toLowerCase()}`));
      let stored = 0;

      for (const memory of parsed.memories ?? []) {
        if (typeof memory.username !== "string" || typeof memory.content !== "string") continue;
        const contentText = memory.content.trim();
        if (!contentText) continue;
        const person = humans.find(
          (candidate) => candidate.username?.toLowerCase() === memory.username?.toString().toLowerCase(),
        );
        if (!person) continue;
        const key = `${person.id}:${contentText.toLowerCase()}`;
        if (known.has(key)) continue;
        known.add(key);
        await this.db.memory.create({ data: { userId: person.id, content: contentText } });
        stored += 1;
        console.log(`[agent] memory: ${person.name}: ${contentText}`);
      }

      if (stored === 0) console.log("[agent] memory: nothing new");
    } catch (error) {
      console.error("[agent] memory request failed", error);
    }
  }
}

function plainReply(value: unknown) {
  if (typeof value !== "string") return null;
  const reply = value.trim();
  if (!reply || reply.toLowerCase() === "null" || reply.startsWith("{") || reply.startsWith("[")) {
    return null;
  }
  return reply;
}

export const agent = new Agent(prisma);
