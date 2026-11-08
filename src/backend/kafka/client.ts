import { Kafka } from "kafkajs";

process.env.KAFKAJS_NO_PARTITIONER_WARNING ??= "1";

export const CHAT_TOPIC = "chat.messages";
export const CHAT_GROUP = "chat-agent";

let kafka: Kafka | undefined;

export function kafkaClient() {
  kafka ??= new Kafka({
    clientId: "ai-chat",
    brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092")
      .split(",")
      .map((broker) => broker.trim())
      .filter(Boolean),
    connectionTimeout: 1000,
    retry: { retries: 2, initialRetryTime: 100 },
  });
  return kafka;
}
