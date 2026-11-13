import { CHAT_TOPIC, ensureChatTopic, kafkaClient } from "@/backend/kafka/client";

// Shared Kafka subscription. Each consumer implements handle for one record.
export abstract class IConsumer {
  protected abstract readonly groupId: string;

  async consume() {
    await ensureChatTopic();
    const consumer = kafkaClient().consumer({ groupId: this.groupId });
    await consumer.connect();
    await consumer.subscribe({ topic: CHAT_TOPIC, fromBeginning: true });
    await consumer.run({
      eachMessage: async ({ message }) => {
        const raw = message.value?.toString();
        if (!raw) return;
        await this.handle(raw);
      },
    });
  }

  protected abstract handle(raw: string): Promise<void>;
}
