import { WebSocket, WebSocketServer } from "ws";
import { describe, expect, it, vi } from "vitest";
import { publish } from "@/backend/realtime/server";

const payload = JSON.stringify({
  chatId: "chat-1",
  messageId: "message-1",
  memberIds: ["sam"],
  message: {
    id: "message-1",
    body: "hello",
    createdAt: "2026-01-01T00:00:00.000Z",
    authorId: "sam",
    authorName: "Sam",
  },
});

describe("live socket frames", () => {
  it("delivers a redis payload to a member and skips everyone else", async () => {
    const sockets = new WebSocketServer({ port: 0, host: "127.0.0.1" });
    if (!sockets.address()) {
      await new Promise<void>((resolve) => sockets.once("listening", resolve));
    }
    const address = sockets.address();
    if (!address || typeof address === "string") throw new Error("expected a tcp port");
    const client = new WebSocket(`ws://127.0.0.1:${address.port}`);
    const connected = new Promise<WebSocket>((resolve) => sockets.once("connection", resolve));
    const serverSocket = await connected;
    const stranger = { readyState: WebSocket.OPEN, send: vi.fn() };

    const received = new Promise<string>((resolve) => {
      client.once("message", (data) => resolve(String(data)));
    });
    publish(
      [
        { socket: serverSocket, userId: "sam", channels: new Set() },
        { socket: stranger as never, userId: "alex", channels: new Set() },
      ],
      payload,
    );

    await expect(received).resolves.toBe(
      JSON.stringify({
        type: "message",
        chatId: "chat-1",
        message: {
          id: "message-1",
          body: "hello",
          createdAt: "2026-01-01T00:00:00.000Z",
          authorId: "sam",
          authorName: "Sam",
        },
      }),
    );
    expect(stranger.send).not.toHaveBeenCalled();
    client.close();
    await new Promise<void>((resolve) => sockets.close(() => resolve()));
  });
});
