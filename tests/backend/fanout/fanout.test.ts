import { describe, expect, it, vi } from "vitest";
import { FanoutConsumer } from "@/backend/consumers/fanout/fanout";

describe("FanoutConsumer", () => {
  it("publishes the payload on the chat channel", async () => {
    const publish = vi.fn(async () => 1);
    const payload = JSON.stringify({
      chatId: "chat-1",
      messageId: "message-1",
      memberIds: ["sam"],
      message: { id: "message-1", body: "hello" },
    });

    await new FanoutConsumer(publish).handle(payload);

    expect(publish).toHaveBeenCalledWith("chat:chat-1", payload);
  });

  it("drops a payload that has no chat id", async () => {
    const publish = vi.fn(async () => 1);
    await new FanoutConsumer(publish).handle("{");
    await new FanoutConsumer(publish).handle(JSON.stringify({ messageId: "message-1" }));
    expect(publish).not.toHaveBeenCalled();
  });
});
