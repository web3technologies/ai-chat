import "server-only";
import { PrismaClient } from "./generated/client";
import { withAccelerate } from "@prisma/extension-accelerate";

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  return new PrismaClient({
    accelerateUrl: url,
    log: ["warn", "error"],
  }).$extends(withAccelerate());
}

export type PrismaClientWithExtensions = ReturnType<typeof createPrismaClient>;

const globalForPrisma = global as unknown as {
  prisma: PrismaClientWithExtensions | undefined;
};

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
