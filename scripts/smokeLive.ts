import "dotenv/config";
import { WebSocket } from "ws";

const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const wsUrl = process.env.SMOKE_WS_URL ?? "ws://localhost:3001";
const password = process.env.SEED_PASSWORD ?? "password";
const body = `smoke live ${Date.now()}`;

async function main() {
  const signin = await fetch(`${base}/api/auth/signin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "sam", password }),
  });
  if (!signin.ok) throw new Error(`signin ${signin.status}`);
  const { token } = (await signin.json()) as { token: string };

  const created = await fetch(`${base}/api/chats`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ kind: "DM", usernames: ["jordan"] }),
  });
  if (!created.ok) throw new Error(`create ${created.status} ${await created.text()}`);
  const { chat } = (await created.json()) as { chat: { id: string } };

  const received = new Promise<string>((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("timed out waiting for the live message"));
    }, 20000);
    socket.on("open", () => {
      socket.send(JSON.stringify({ type: "auth", token }));
      socket.send(JSON.stringify({ type: "watch", chatId: chat.id }));
    });
    socket.on("message", (data) => {
      const parsed = JSON.parse(String(data)) as { type?: string; message?: { id?: string; body?: string } };
      if (parsed.type !== "message" || parsed.message?.body !== body || !parsed.message.id) return;
      clearTimeout(timer);
      socket.close();
      resolve(parsed.message.id);
    });
    socket.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

  await new Promise((resolve) => setTimeout(resolve, 500));
  const sent = await fetch(`${base}/api/chats/${chat.id}/send`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!sent.ok) throw new Error(`send ${sent.status} ${await sent.text()}`);

  const id = await received;
  console.log(`[smoke] live message ${id}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
