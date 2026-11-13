import { ensureChatTopic } from "@/backend/kafka/client";
import type { ChatRepository } from "@/backend/repositories/chat";

const POLL_MS = 200;

type Publisher = {
  publish(chatId: string, payload: string): Promise<void>;
};

export class OutboxRelay {
  constructor(
    private readonly chats: ChatRepository,
    private readonly publisher: Publisher,
  ) {}

  async publishPending() {
    const rows = await this.chats.listUnpublished();
    for (const row of rows) {
      await this.publisher.publish(row.chatId, row.payload);
      await this.chats.markPublished(row.id);
    }
    return rows.length;
  }

  async run() {
    await ensureChatTopic();
    for (;;) {
      try {
        const count = await this.publishPending();
        if (count === 0) await sleep(POLL_MS);
      } catch (error) {
        console.error("[relay] publish failed", error);
        await sleep(POLL_MS);
      }
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
