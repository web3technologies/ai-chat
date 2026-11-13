import "dotenv/config";
import chatProducer from "@/backend/producers/chat";
import { chatRepository } from "@/backend/repositories/chat";
import { OutboxRelay } from "./relay";

const relay = new OutboxRelay(chatRepository, chatProducer);

relay.run().catch((error) => {
  console.error("[relay] stopped", error);
  process.exit(1);
});
