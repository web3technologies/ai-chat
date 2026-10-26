import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("openai", () => ({
  default: class OpenAI {
    chat = { completions: { create } };
  },
}));

import { Agent } from "@/backend/services/agent/agent";
import { instructions } from "@/backend/services/agent/prompt";

function completion(content: string | null) {
  return { choices: [{ message: { content } }] };
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
  const agent = new Agent(db as never);
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
    await agent.remember([{ id: "sam", username: "sam", name: "Sam" }], []);
    expect(create).not.toHaveBeenCalled();
    expect(db.memory.create).not.toHaveBeenCalled();
  });

  it.each([null, "", "null"])("stays quiet when the reply is %j", async (reply) => {
    create.mockResolvedValue(completion(JSON.stringify({ reply })));
    await expect(
      agent.consider([{ authorName: "Sam", kind: "HUMAN", body: "Agent, hey" }], []),
    ).resolves.toBeNull();
  });

  it("stays quiet without calling the model when the latest message is not for the agent", async () => {
    await expect(
      agent.consider(
        [
          { authorName: "Alex", kind: "HUMAN", body: "Hmm agent any thoughts?" },
          { authorName: "Agent", kind: "AGENT", body: "Try a burger place." },
          { authorName: "Alex", kind: "HUMAN", body: "What time you wanna go Sam?" },
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
      agent.consider([{ authorName: "Sam", kind: "HUMAN", body: "Agent, what time?" }], []),
    ).resolves.toBeNull();
  });

  it("sends each turn as its own message", async () => {
    create.mockResolvedValue(completion(JSON.stringify({ reply: "68" })));
    await agent.consider(
      [
        { authorName: "Sam", kind: "HUMAN", body: "hey" },
        { authorName: "Agent", kind: "AGENT", body: "hi" },
        { authorName: "Sam", kind: "HUMAN", body: "Agent, what is 17 times 4?" },
      ],
      [{ name: "Sam", content: "likes burgers" }],
    );

    expect(create.mock.calls[0][0].messages).toEqual([
      { role: "system", content: instructions },
      { role: "system", content: "Known facts:\n- Sam: likes burgers" },
      { role: "user", content: "Sam: hey" },
      { role: "assistant", content: "hi" },
      { role: "user", content: "Sam: Agent, what is 17 times 4?" },
    ]);
  });

  it("returns a trimmed reply", async () => {
    create.mockResolvedValue(completion(JSON.stringify({ reply: "  68  " })));
    await expect(
      agent.consider([{ authorName: "Sam", kind: "HUMAN", body: "Agent, what is 17 times 4?" }], []),
    ).resolves.toBe("68");
  });

  it("stays quiet when the request throws", async () => {
    create.mockRejectedValue(new Error("down"));
    await expect(
      agent.consider([{ authorName: "Sam", kind: "HUMAN", body: "Agent, what is 17 times 4?" }], []),
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
    await agent.remember([{ id: "user-sam", username: "sam", name: "Sam" }], [
      { username: "sam", name: "Sam", kind: "HUMAN", body: "I like pizza" },
    ]);

    expect(memories).toEqual([{ userId: "user-sam", content: "likes pizza" }]);
  });
});
