import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

function createPrismaClient(url: string) {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
    log: ["warn", "error"],
  });
}

const globalForPrisma = global as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
  prismaRead?: ReturnType<typeof createPrismaClient>;
  prismaReadUrl?: string;
};

function writeUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}

function readUrl() {
  return process.env.DATABASE_READ_URL || writeUrl();
}

function prismaClient() {
  globalForPrisma.prisma ??= createPrismaClient(writeUrl());
  return globalForPrisma.prisma;
}

function prismaReadClient() {
  const url = readUrl();
  if (!process.env.DATABASE_READ_URL || url === process.env.DATABASE_URL) return prismaClient();
  if (!globalForPrisma.prismaRead || globalForPrisma.prismaReadUrl !== url) {
    globalForPrisma.prismaRead = createPrismaClient(url);
    globalForPrisma.prismaReadUrl = url;
  }
  return globalForPrisma.prismaRead;
}

function clientProxy(load: () => ReturnType<typeof createPrismaClient>) {
  return new Proxy({} as ReturnType<typeof createPrismaClient>, {
    get(_target, property) {
      const client = load();
      const value = Reflect.get(client, property, client);
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
}

// Created on first use so `next build` can load routes before DATABASE_URL exists.
const prisma = clientProxy(prismaClient);
export default prisma;

export const prismaRead = clientProxy(prismaReadClient);
