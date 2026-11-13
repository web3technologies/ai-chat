import { chatChannel } from "@/backend/realtime/channels";
import { FANOUT_GROUP } from "@/backend/kafka/client";
import { IConsumer } from "@/backend/consumers/IConsumer";

type Publish = (channel: string, payload: string) => Promise<unknown>;

export class FanoutConsumer extends IConsumer {
  protected readonly groupId = FANOUT_GROUP;

  constructor(private readonly publish: Publish) {
    super();
  }

  async handle(raw: string) {
    let parsed: { chatId?: unknown };
    try {
      parsed = JSON.parse(raw) as { chatId?: unknown };
    } catch (error) {
      console.error("[fanout] bad payload", error);
      return;
    }
    if (typeof parsed.chatId !== "string" || !parsed.chatId) return;
    await this.publish(chatChannel(parsed.chatId), raw);
  }
}
