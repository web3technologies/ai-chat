import { WebSocket, WebSocketServer } from "ws";
import { chatReads } from "@/backend/repositories/chat";
import { createRedis } from "@/backend/redis/client";
import { authToken } from "@/backend/services/auth/token";
import { chatChannel } from "./channels";

type LiveSocket = {
  socket: WebSocket;
  userId: string | null;
  channels: Set<string>;
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

function listenPort() {
  const parsed = Number(process.env.REALTIME_PORT);
  if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) return parsed;
  return 3001;
}

export async function startRealtime(port = listenPort()) {
  const redis = createRedis();
  redis.on("error", (error) => {
    console.error("[realtime] redis connection failed", error);
  });

  const clients: LiveSocket[] = [];
  const counts = new Map<string, number>();

  redis.on("message", (_channel, payload) => {
    publish(clients, payload);
  });

  const watch = async (client: LiveSocket, chatIds: string[]) => {
    for (const chatId of chatIds) {
      const channel = chatChannel(chatId);
      if (client.channels.has(channel)) continue;
      client.channels.add(channel);
      const next = (counts.get(channel) ?? 0) + 1;
      counts.set(channel, next);
      if (next === 1) await redis.subscribe(channel);
    }
  };

  const unwatch = async (client: LiveSocket) => {
    for (const channel of client.channels) {
      const next = (counts.get(channel) ?? 1) - 1;
      if (next <= 0) {
        counts.delete(channel);
        await redis.unsubscribe(channel);
      } else {
        counts.set(channel, next);
      }
    }
    client.channels.clear();
  };

  const sockets = new WebSocketServer({ port });
  sockets.on("connection", (socket) => {
    const client: LiveSocket = { socket, userId: null, channels: new Set() };
    clients.push(client);
    const timer = setTimeout(() => {
      if (!client.userId) socket.close(1008, "Unauthorized");
    }, 5000);

    let authenticating = false;
    const pending: string[] = [];

    const authenticate = async (raw: string) => {
      let parsed: { type?: unknown; token?: unknown };
      try {
        parsed = JSON.parse(raw) as { type?: unknown; token?: unknown };
      } catch {
        socket.close(1008, "Unauthorized");
        return;
      }
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
      const memberships = await chatReads.chatIdsForMember(userId);
      await watch(
        client,
        memberships.map((membership) => membership.chatId),
      );
    };

    const subscribe = async (raw: string) => {
      if (!client.userId) return;
      let parsed: { type?: unknown; chatId?: unknown };
      try {
        parsed = JSON.parse(raw) as { type?: unknown; chatId?: unknown };
      } catch {
        return;
      }
      if (parsed.type !== "watch" || typeof parsed.chatId !== "string") return;
      const membership = await chatReads.findMembership(parsed.chatId, client.userId);
      if (!membership) return;
      await watch(client, [parsed.chatId]);
    };

    socket.on("message", (data) => {
      const raw = data.toString();
      if (client.userId) {
        void subscribe(raw).catch((error) => console.error("[realtime] watch failed", error));
        return;
      }
      if (authenticating) {
        pending.push(raw);
        return;
      }
      authenticating = true;
      void (async () => {
        try {
          await authenticate(raw);
        } catch (error) {
          console.error("[realtime] auth failed", error);
          socket.close(1011, "Unavailable");
          return;
        }
        if (!client.userId) return;
        for (const next of pending.splice(0)) {
          try {
            await subscribe(next);
          } catch (error) {
            console.error("[realtime] watch failed", error);
          }
        }
      })();
    });

    socket.on("close", () => {
      clearTimeout(timer);
      void unwatch(client);
      const index = clients.indexOf(client);
      if (index >= 0) clients.splice(index, 1);
    });
  });

  console.log(`[realtime] listening on ${port}`);
}
