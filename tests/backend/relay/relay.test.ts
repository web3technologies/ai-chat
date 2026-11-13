import { describe, expect, it, vi } from "vitest";
import { ChatRepository } from "@/backend/repositories/chat";
import { OutboxRelay } from "@/backend/relay/relay";

describe("OutboxRelay", () => {
  const payload = JSON.stringify({
    chatId: "chat-1",
    messageId: "message-1",
    memberIds: ["sam"],
    message: { id: "message-1", body: "hello" },
  });
  const rows = [{ id: "out-1", chatId: "chat-1", messageId: "message-1", payload }];

  function relay() {
    const update = vi.fn(async () => ({}));
    const db = {
      outbox: {
        findMany: vi.fn(async () => rows),
        update,
      },
    };
    const publish = vi.fn(async () => undefined);
    return {
      update,
      publish,
      relay: new OutboxRelay(new ChatRepository(db as never), { publish }),
    };
  }

  it("publishes each unpublished payload and marks the row", async () => {
    const setup = relay();
    await expect(setup.relay.publishPending()).resolves.toBe(1);
    expect(setup.publish).toHaveBeenCalledWith("chat-1", payload);
    expect(setup.update).toHaveBeenCalledWith({
      where: { id: "out-1" },
      data: { publishedAt: expect.any(Date) },
    });
  });

  it("leaves the row unpublished when Kafka rejects it", async () => {
    const setup = relay();
    setup.publish.mockRejectedValueOnce(new Error("down"));
    await expect(setup.relay.publishPending()).rejects.toThrow("down");
    expect(setup.update).not.toHaveBeenCalled();
  });
});
