import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { create, decide } = vi.hoisted(() => ({ create: vi.fn(), decide: vi.fn() }));

vi.mock("openai", () => ({
  default: class OpenAI {
    chat = { completions: { create } };
    decisions = { create: decide };
  },
}));

import { UserRepository } from "@/backend/repositories/user";
import { Agent } from "@/backend/services/agent/agent";
import { instructions } from "@/backend/services/agent/prompt";

function completion(content: string | null) {
  return { choices: [{ message: { content } }] };
}

function predicate(probability: number) {
  return { answers: [{ type: "predicate", name: "should_reply", probability }] };
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
      memories: [
        {
          content: fact.content,
          visibility: "PRIVATE" as const,
          audience: [{ userId: fact.name }],
        },
      ],
    },
  }));
}

describe("Agent", () => {
  const memories: {
    id: string;
    userId: string;
    content: string;
    visibility: "PRIVATE" | "PARTICIPANTS";
    status: "ACTIVE" | "SUPERSEDED";
    replacesId?: string;
    audience: { create: { userId: string }[] };
  }[] = [];
  const db = {
    memory: {
      findMany: vi.fn(async ({ where }: { where?: { status?: "ACTIVE" | "SUPERSEDED" } } = {}) =>
        memories
          .filter((memory) => !where?.status || memory.status === where.status)
          .map((memory) => ({
            id: memory.id,
            userId: memory.userId,
            content: memory.content,
            visibility: memory.visibility,
            audience: memory.audience.create,
          })),
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: {
            userId: string;
            content: string;
            visibility: "PRIVATE" | "PARTICIPANTS";
            replacesId?: string;
            audience: { create: { userId: string }[] };
          };
        }) => {
          const row = { id: `memory-${memories.length + 1}`, status: "ACTIVE" as const, ...data };
          memories.push(row);
          return row;
        },
      ),
      update: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = memories.find((memory) => memory.id === where.id);
        if (!row) return null;
        row.status = "SUPERSEDED";
        return row;
      }),
    },
  };
  const agent = new Agent(new UserRepository(db as never));
  const previousKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    memories.splice(0, memories.length);
    create.mockReset();
    decide.mockReset();
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  });

  it("stays quiet and stores nothing without an API key", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(agent.consider([])).resolves.toBe(false);
    await expect(agent.reply([], [])).resolves.toBeNull();
    await expect(agent.remember(room([{ name: "Sam", content: "likes pizza" }]), [])).resolves.toEqual([]);
    expect(decide).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(db.memory.create).not.toHaveBeenCalled();
  });

  it("asks the decision model whether the latest message is for the agent", async () => {
    decide.mockResolvedValue(predicate(0.91));
    const messages = [
      message("Alex", "HUMAN", "Hmm agent any thoughts?"),
      message("Agent", "AGENT", "Try a burger place."),
      message("Sam", "HUMAN", "Agent, what time?"),
    ];

    await expect(agent.consider(messages)).resolves.toBe(true);
    expect(decide).toHaveBeenCalledWith({
      model: "gpt-6-luna",
      input: "Alex: Hmm agent any thoughts?\nAgent: Try a burger place.\nSam: Agent, what time?",
      questions: [
        {
          type: "predicate",
          name: "should_reply",
          instructions:
            "The latest message is for the agent named Agent. Count a question or request that names the agent, and a follow-up to the agent's previous message, such as a correction, a confirmation, or try again, even when the name is absent. People talking only to each other are not for the agent.",
        },
      ],
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("stays quiet when the decision is below the threshold, refused, or unavailable", async () => {
    decide.mockResolvedValueOnce(predicate(0.69));
    await expect(agent.consider([message("Sam", "HUMAN", "what time?")])).resolves.toBe(false);

    decide.mockResolvedValueOnce({ answers: [{ type: "refusal", name: "should_reply" }] });
    await expect(agent.consider([message("Sam", "HUMAN", "Agent, hey")])).resolves.toBe(false);

    decide.mockRejectedValueOnce(new Error("down"));
    await expect(agent.consider([message("Sam", "HUMAN", "Agent, hey")])).resolves.toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("stays quiet without a decision when the latest message is from the agent", async () => {
    await expect(agent.consider([message("Agent", "AGENT", "Try a burger place.")])).resolves.toBe(false);
    expect(decide).not.toHaveBeenCalled();
  });

  it.each([null, "", "null"])("returns nothing when the reply is %j", async (reply) => {
    create.mockResolvedValue(completion(JSON.stringify({ reply })));
    await expect(agent.reply([message("Sam", "HUMAN", "Agent, hey")], [])).resolves.toBeNull();
  });

  it("drops a reply that is JSON instead of a sentence", async () => {
    create.mockResolvedValue(
      completion(
        JSON.stringify({
          reply: '{"type":"object","properties":{"reply":"Great! Enjoy your meal at Pluckers at 6 PM!"}}',
        }),
      ),
    );
    await expect(agent.reply([message("Sam", "HUMAN", "Agent, what time?")], [])).resolves.toBeNull();
  });

  it("sends each turn as its own message", async () => {
    create.mockResolvedValue(completion(JSON.stringify({ reply: "68" })));
    await agent.reply(
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
    await expect(agent.reply([message("Sam", "HUMAN", "Agent, what is 17 times 4?")], [])).resolves.toBe("68");
  });

  it("returns nothing when the reply request throws", async () => {
    create.mockRejectedValue(new Error("down"));
    await expect(agent.reply([message("Sam", "HUMAN", "Agent, what is 17 times 4?")], [])).resolves.toBeNull();
  });

  it("returns the model's memory operations and shows the known facts", async () => {
    await expect(agent.remember([], [])).resolves.toEqual([]);
    expect(create).not.toHaveBeenCalled();

    const operations = [
      { op: "add", id: "", username: "sam", content: " likes pizza " },
      { op: "add", id: "", username: "sam", content: "Likes Pizza" },
      { op: "add", id: "", username: "missing", content: "lives on the moon" },
    ];
    create.mockResolvedValue(completion(JSON.stringify({ operations })));
    const room = [{ user: { id: "user-sam", username: "sam", name: "Sam", kind: "HUMAN" as const, memories: [] } }];

    await expect(
      agent.remember(room, [message("Sam", "HUMAN", "I like pizza")], [{ id: "memory-1", username: "sam", content: "likes tacos" }]),
    ).resolves.toEqual(operations);
    expect(create.mock.calls[0][0].messages[1].content).toContain("Known facts:\nmemory-1 sam: likes tacos");
    expect(db.memory.create).not.toHaveBeenCalled();
  });

  it("shares a fact with the people in the room and keeps a private fact out of a larger room", async () => {
    create.mockResolvedValue(
      completion(
        JSON.stringify({
          operations: [{ op: "add", id: "", username: "sam", content: "lives in Austin" }],
        }),
      ),
    );
    await expect(
      agent.remember(
        [
          { user: { id: "user-sam", username: "sam", name: "Sam", kind: "HUMAN", memories: [] } },
          { user: { id: "user-jordan", username: "jordan", name: "Jordan", kind: "HUMAN", memories: [] } },
        ],
        [message("Sam", "HUMAN", "I live in Austin")],
      ),
    ).resolves.toEqual([{ op: "add", id: "", username: "sam", content: "lives in Austin" }]);

    create.mockResolvedValue(completion(JSON.stringify({ reply: "Austin" })));
    const sam = {
      id: "user-sam",
      username: "sam",
      name: "Sam",
      kind: "HUMAN" as const,
      memories: [
        {
          content: "allergic to peanuts",
          visibility: "PRIVATE" as const,
          audience: [{ userId: "user-sam" }],
        },
        {
          content: "lives in Austin",
          visibility: "PARTICIPANTS" as const,
          audience: [{ userId: "user-sam" }, { userId: "user-jordan" }],
        },
      ],
    };
    const jordan = {
      id: "user-jordan",
      username: "jordan",
      name: "Jordan",
      kind: "HUMAN" as const,
      memories: [],
    };
    await agent.reply([message("Jordan", "HUMAN", "Agent, where does Sam live?")], [
      { user: sam },
      { user: jordan },
    ]);
    expect(create.mock.calls[1][0].messages[1].content).toBe("Quoted facts:\n- Sam: lives in Austin");

    await agent.reply(
      [message("Alex", "HUMAN", "Agent, where does Sam live?")],
      [{ user: sam }, { user: jordan }, { user: { ...jordan, id: "user-alex", username: "alex", name: "Alex" } }],
    );
    expect(create.mock.calls[2][0].messages[1].content).toBe("Quoted facts:\nNone");
  });
});
