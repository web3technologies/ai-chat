import { CHAT_TOPIC, MEMORY_GROUP, kafkaClient } from "@/backend/kafka/client";
import { memoryService, type MemoryService } from "@/backend/services/memory/memory";

export class MemoryConsumer {
  constructor(private readonly memories: MemoryService) {}

  async consume() {
    const consumer = kafkaClient().consumer({ groupId: MEMORY_GROUP });
    await consumer.connect();
    await consumer.subscribe({ topic: CHAT_TOPIC, fromBeginning: true });
    await consumer.run({
      eachMessage: async ({ message }) => {
        const raw = message.value?.toString();
        if (!raw) return;
        let parsed: { chatId?: unknown; messageId?: unknown };
        try {
          parsed = JSON.parse(raw) as { chatId?: unknown; messageId?: unknown };
        } catch (error) {
          console.error("[kafka] memory consume failed", error);
          return;
        }
        if (typeof parsed.chatId !== "string" || !parsed.chatId) return;
        if (typeof parsed.messageId !== "string" || !parsed.messageId) return;
        try {
          await this.memories.rememberMessage(parsed.chatId, parsed.messageId);
        } catch (error) {
          console.error("[kafka] memory consume failed", error);
          throw error;
        }
      },
    });
  }
}

const memoryConsumer = new MemoryConsumer(memoryService);
export default memoryConsumer;
