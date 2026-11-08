import { Client } from "pg";
import { WebSocket, WebSocketServer } from "ws";
import { authToken } from "@/backend/services/auth/token";

type LiveSocket = {
  socket: WebSocket;
  userId: string | null;
};

type ChatNotice = {
  chatId: string;
  memberIds: string[];
  message: {
    id: string;
    body: string;
    createdAt: string;
    authorId: string;
    authorName: string;
  };
};

export function publish(clients: LiveSocket[], raw: string) {
  let notice: ChatNotice;
  try {
    notice = JSON.parse(raw) as ChatNotice;
  } catch {
    return;
  }
  if (!notice?.chatId || !Array.isArray(notice.memberIds) || !notice.message?.id) return;

  const body = JSON.stringify({ type: "message", chatId: notice.chatId, message: notice.message });
  const members = new Set(notice.memberIds);
  for (const client of clients) {
    if (!client.userId || !members.has(client.userId) || client.socket.readyState !== WebSocket.OPEN) continue;
    client.socket.send(body);
  }
}

export async function startRealtime(port = Number(process.env.REALTIME_PORT ?? 3001)) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");

  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  await db.query("LISTEN chat_messages");

  const clients: LiveSocket[] = [];
  db.on("notification", (message) => {
    if (message.channel !== "chat_messages" || !message.payload) return;
    publish(clients, message.payload);
  });
  db.on("error", (error) => {
    console.error("[realtime] database connection failed", error);
    process.exit(1);
  });

  const sockets = new WebSocketServer({ port });
  sockets.on("connection", (socket) => {
    const client: LiveSocket = { socket, userId: null };
    clients.push(client);
    const timer = setTimeout(() => {
      if (!client.userId) socket.close(1008, "Unauthorized");
    }, 5000);

    socket.on("message", async (data) => {
      if (client.userId) return;
      try {
        const parsed = JSON.parse(data.toString()) as { type?: unknown; token?: unknown };
        if (parsed.type !== "auth" || typeof parsed.token !== "string") {
          socket.close(1008, "Unauthorized");
          return;
        }
        const userId = await authToken.userIdFrom(parsed.token);
        if (!userId) {
          socket.close(1008, "Unauthorized");
          return;
        }
        client.userId = userId;
        clearTimeout(timer);
      } catch {
        socket.close(1008, "Unauthorized");
      }
    });

    socket.on("close", () => {
      clearTimeout(timer);
      const index = clients.indexOf(client);
      if (index >= 0) clients.splice(index, 1);
    });
  });

  console.log(`[realtime] listening on ${port}`);
}
