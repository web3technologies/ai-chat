import "dotenv/config";
import { startRealtime } from "./server";

startRealtime().catch((error) => {
  console.error("[realtime] stopped", error);
  process.exit(1);
});
