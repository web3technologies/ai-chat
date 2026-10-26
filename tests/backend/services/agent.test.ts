import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("openai", () => ({
  default: class OpenAI {
    chat = { completions: { create } };
  },
}));

import { MemoryRepository } from "@/backend/repositories/memory";
import { UserRepository } from "@/backend/repositories/user";
import { Agent } from "@/backend/services/agent/agent";
import { instructions } from "@/backend/services/agent/prompt";

function completion(content: string | null) {
  return { choices: [{ message: { content } }] };
}

function message(name: string, kind: "HUMAN" | "AGENT", body: string) {
  return { body, author: { name, username: name.toLowerCase(), kind } };
}

function room(facts: { name: string; content: string }[] = []) {
  return facts.map((fact) => ({
    user: {
      id: fact.name,
      username: fact.name.toLowerCase(),
      name: fact.name,
      kind: "HUMAN" as const,
      memories: [{ content: fact.content }],
    },
  }));
}

describe("Agent", () => {
  const memories: { userId: string; content: string }[] = [];
  const db = {
    memory: {
      findMany: vi.fn(async () => memories.map((memory) => ({ ...memory }))),
      create: vi.fn(async ({ data }: { data: { userId: string; content: string } }) => {
        memories.push(data);
        return data;
      }),
    },
  };
  const agent = new Agent(new UserRepository(db as never), new MemoryRepository(db as never));
  const previousKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    memories.splice(0, memories.length);
    create.mockReset();
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  });

  it("stays quiet and stores nothing without an API key", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(agent.consider([], [])).resolves.toBeNull();
    await agent.remember(room([{ name: "Sam", content: "likes pizza" }]), []);
    expect(create).not.toHaveBeenCalled();
    expect(db.memory.create).not.toHaveBeenCalled();
  });

  it.each([null, "", "null"])("stays quiet when the reply is %j", async (reply) => {
    create.mockResolvedValue(completion(JSON.stringify({ reply })));
    await expect(
      agent.consider([message("Sam", "HUMAN", "Agent, hey")], []),
    ).resolves.toBeNull();
  });

  it("stays quiet without calling the model when the latest message is not for the agent", async () => {
    await expect(
      agent.consider(
        [
          message("Alex", "HUMAN", "Hmm agent any thoughts?"),
          message("Agent", "AGENT", "Try a burger place."),
          message("Alex", "HUMAN", "What time you wanna go Sam?"),
        ],
        [],
      ),
    ).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("drops a reply that is JSON instead of a sentence", async () => {
    create.mockResolvedValue(
      completion(
        JSON.stringify({
          reply: '{"type":"object","properties":{"reply":"Great! Enjoy your meal at Pluckers at 6 PM!"}}',
        }),
      ),
    );
    await expect(
      agent.consider([message("Sam", "HUMAN", "Agent, what time?")], []),
    ).resolves.toBeNull();
  });

  it("sends each turn as its own message", async () => {
    create.mockResolvedValue(completion(JSON.stringify({ reply: "68" })));
    await agent.consider(
      [
        message("Sam", "HUMAN", "hey"),
        message("Agent", "AGENT", "hi"),
        message("Sam", "HUMAN", "Agent, what is 17 times 4?"),
      ],
      room([{ name: "Sam", content: "likes burgers" }]),
    );

    expect(create.mock.calls[0][0].messages).toEqual([
      { role: "system", content: instructions },
      { role: "user", content: "Quoted facts:\n- Sam: likes burgers" },
      { role: "user", content: "Sam: hey" },
      { role: "assistant", content: "hi" },
      { role: "user", content: "Sam: Agent, what is 17 times 4?" },
    ]);
  });

  it("returns a trimmed reply", async () => {
    create.mockResolvedValue(completion(JSON.stringify({ reply: "  68  " })));
    await expect(
      agent.consider([message("Sam", "HUMAN", "Agent, what is 17 times 4?")], []),
    ).resolves.toBe("68");
  });

  it("stays quiet when the request throws", async () => {
    create.mockRejectedValue(new Error("down"));
    await expect(
      agent.consider([message("Sam", "HUMAN", "Agent, what is 17 times 4?")], []),
    ).resolves.toBeNull();
  });

  it("stores a new fact and skips duplicates, unknown people, and an empty room", async () => {
    await agent.remember([], []);
    expect(create).not.toHaveBeenCalled();

    create.mockResolvedValue(
      completion(
        JSON.stringify({
          memories: [
            { username: "sam", content: " likes pizza " },
            { username: "sam", content: "Likes Pizza" },
            { username: "missing", content: "lives on the moon" },
          ],
        }),
      ),
    );
    await agent.remember(
      [
        {
          user: { id: "user-sam", username: "sam", name: "Sam", kind: "HUMAN", memories: [] },
        },
      ],
      [message("Sam", "HUMAN", "I like pizza")],
    );

    expect(memories).toEqual([{ userId: "user-sam", content: "likes pizza" }]);
  });
});
