import { Kafka } from "kafkajs";

process.env.KAFKAJS_NO_PARTITIONER_WARNING ??= "1";

export const CHAT_TOPIC = "chat.messages";
export const CHAT_GROUP = "chat-agent";
export const MEMORY_GROUP = "chat-memory";
export const CHAT_PARTITIONS = 4;

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

export async function ensureChatTopic() {
  const admin = kafkaClient().admin();
  await admin.connect();
  try {
    const listed = await admin.listTopics();
    if (!listed.includes(CHAT_TOPIC)) {
      await admin.createTopics({
        topics: [{ topic: CHAT_TOPIC, numPartitions: CHAT_PARTITIONS, replicationFactor: 1 }],
      });
      return;
    }
    const metadata = await admin.fetchTopicMetadata({ topics: [CHAT_TOPIC] });
    const current = metadata.topics[0]?.partitions.length ?? 0;
    if (current < CHAT_PARTITIONS) {
      await admin.createPartitions({
        topicPartitions: [{ topic: CHAT_TOPIC, count: CHAT_PARTITIONS }],
      });
    }
  } finally {
    await admin.disconnect();
  }
}
