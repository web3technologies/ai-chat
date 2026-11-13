import "dotenv/config";
import { WebSocket } from "ws";
import prisma from "@/backend/db/prisma/client";
import { chatRepository } from "@/backend/repositories/chat";
import { authToken } from "@/backend/services/auth/token";

async function main() {
  const port = process.env.REALTIME_PORT ?? "3011";
  const user = await prisma.user.findFirst({ where: { username: "sam" } });
  if (!user) throw new Error("sam is not seeded");
  const membership = await prisma.chatMember.findFirst({ where: { userId: user.id } });
  if (!membership) throw new Error("sam has no chat");

  const token = await authToken.sign(user.id);
  const body = `smoke live ${Date.now()}`;
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  const received = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("timed out waiting for the live message"));
    }, 15000);
    socket.on("open", () => {
      socket.send(JSON.stringify({ type: "auth", token }));
      socket.send(JSON.stringify({ type: "watch", chatId: membership.chatId }));
    });
    socket.on("message", (data) => {
      const parsed = JSON.parse(String(data)) as { type?: string; message?: { id?: string; body?: string } };
      if (parsed.type !== "message" || parsed.message?.body !== body || !parsed.message.id) return;
      clearTimeout(timer);
      resolve(parsed.message.id);
    });
    socket.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

  await new Promise((resolve) => setTimeout(resolve, 300));
  const saved = await chatRepository.saveMessage(membership.chatId, user.id, body);
  if (!saved) throw new Error("message was not saved");
  const id = await received;
  if (id !== saved.id) throw new Error(`socket frame ${id} did not match ${saved.id}`);
  console.log(`[smoke] live message ${id}`);
  socket.close();
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
