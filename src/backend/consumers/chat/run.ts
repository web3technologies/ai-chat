import "dotenv/config";
import chatConsumer from "./chat";

chatConsumer.consume().catch((error) => {
  console.error("[kafka] consumer stopped", error);
  process.exit(1);
});
