import "dotenv/config";
import memoryConsumer from "./memories";

memoryConsumer.consume().catch((error) => {
  console.error("[kafka] memory consumer stopped", error);
  process.exit(1);
});
