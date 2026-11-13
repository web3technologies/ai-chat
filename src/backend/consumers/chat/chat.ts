import { CHAT_GROUP } from "@/backend/kafka/client";
import { IConsumer } from "@/backend/consumers/IConsumer";
import { chatService, type ChatService } from "@/backend/services/chat/chat";

export class ChatConsumer extends IConsumer {
  protected readonly groupId = CHAT_GROUP;

  constructor(private readonly chats: ChatService) {
    super();
  }

  protected async handle(raw: string) {
    try {
      const parsed = JSON.parse(raw) as { chatId?: unknown };
      if (typeof parsed.chatId !== "string" || !parsed.chatId) return;
      await this.chats.reply(parsed.chatId);
    } catch (error) {
      console.error("[kafka] consume failed", error);
    }
  }
}

const chatConsumer = new ChatConsumer(chatService);
export default chatConsumer;
