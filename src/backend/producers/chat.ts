import { CHAT_TOPIC, ensureChatTopic, kafkaClient } from "@/backend/kafka/client";
import type { Producer } from "kafkajs";

export class ChatProducer {
  private producer: Producer | null = null;
  private connected = false;
  private topicReady = false;

  async publish(chatId: string, payload: string) {
    try {
      const producer = await this.ensure();
      await producer.send({
        topic: CHAT_TOPIC,
        messages: [{ key: chatId, value: payload }],
      });
    } catch (error) {
      console.error("[kafka] publish failed", error);
      await this.stop();
      throw error;
    }
  }

  private async ensure() {
    if (!this.producer) this.producer = kafkaClient().producer();
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
    }
    if (!this.topicReady) {
      await ensureChatTopic();
      this.topicReady = true;
    }
    return this.producer;
  }

  private async stop() {
    const producer = this.producer;
    this.producer = null;
    this.connected = false;
    this.topicReady = false;
    if (!producer) return;
    try {
      await producer.disconnect();
    } catch {
      // The next send opens a fresh connection.
    }
  }
}

const chatProducer = new ChatProducer();
export default chatProducer;
