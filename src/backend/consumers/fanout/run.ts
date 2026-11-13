import "dotenv/config";
import { createRedis } from "@/backend/redis/client";
import { FanoutConsumer } from "./fanout";

const redis = createRedis();
const fanout = new FanoutConsumer((channel, payload) => redis.publish(channel, payload));

fanout.consume().catch((error) => {
  console.error("[fanout] stopped", error);
  process.exit(1);
});
