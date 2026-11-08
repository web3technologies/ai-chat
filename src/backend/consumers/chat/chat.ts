import { CHAT_GROUP, CHAT_TOPIC, kafkaClient } from "@/backend/kafka/client";
import { chatService, type ChatService } from "@/backend/services/chat/chat";

export class ChatConsumer {
  constructor(private readonly chats: ChatService) {}

  async consume() {
    const consumer = kafkaClient().consumer({ groupId: CHAT_GROUP });
    await consumer.connect();
    await consumer.subscribe({ topic: CHAT_TOPIC, fromBeginning: true });
    await consumer.run({
      eachMessage: async ({ message }) => {
        const raw = message.value?.toString();
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as { chatId?: unknown };
          if (typeof parsed.chatId !== "string" || !parsed.chatId) return;
          await this.chats.reply(parsed.chatId);
        } catch (error) {
          console.error("[kafka] consume failed", error);
        }
      },
    });
  }
}

const chatConsumer = new ChatConsumer(chatService);
export default chatConsumer;
