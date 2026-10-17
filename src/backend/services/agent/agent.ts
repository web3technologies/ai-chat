import "server-only";
import OpenAI from "openai";
import prisma from "@/backend/db/prisma/client";

export type TranscriptTurn = {
  authorName: string;
  kind: "HUMAN" | "AGENT";
  body: string;
};

const instructions = `You are a member of this chat named Agent.
Read the transcript and reply only when you can actually help.
Stay quiet for greetings, small talk, and messages meant for the other people.
When you stay quiet, set reply to null. Otherwise set reply to the message you would send.`;

export class Agent {
  constructor(private readonly db: typeof prisma) {}

  async user() {
    return this.db.user.upsert({
      where: { username: "agent" },
      update: { name: "Agent", kind: "AGENT" },
      create: { username: "agent", name: "Agent", kind: "AGENT" },
    });
  }

  async consider(transcript: TranscriptTurn[]): Promise<string | null> {
    if (!process.env.OPENAI_API_KEY) {
      console.log("[agent] skipped: OPENAI_API_KEY is not set");
      return null;
    }

    console.log(`[agent] considering ${transcript.length} messages`);
    for (const turn of transcript) {
      console.log(`[agent] ${turn.authorName} (${turn.kind}): ${turn.body}`);
    }

    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: instructions },
          {
            role: "user",
            content: transcript
              .map((turn) => `${turn.authorName} (${turn.kind}): ${turn.body}`)
              .join("\n"),
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
      const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
      console.log("parsed", parsed)
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
}

export const agent = new Agent(prisma);
