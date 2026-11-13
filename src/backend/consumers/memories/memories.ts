import { MEMORY_GROUP } from "@/backend/kafka/client";
import { IConsumer } from "@/backend/consumers/IConsumer";
import { memoryService, type MemoryService } from "@/backend/services/memory/memory";

export class MemoryConsumer extends IConsumer {
  protected readonly groupId = MEMORY_GROUP;

  constructor(private readonly memories: MemoryService) {
    super();
  }

  protected async handle(raw: string) {
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
  }
}

const memoryConsumer = new MemoryConsumer(memoryService);
export default memoryConsumer;
