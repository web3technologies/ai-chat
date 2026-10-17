import "dotenv/config";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/backend/db/prisma/generated/client";

const scryptAsync = promisify(scrypt);

const users = [
  { username: "sam", name: "Sam" },
  { username: "jordan", name: "Jordan" },
  { username: "alex", name: "Alex" },
];

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const password = process.env.SEED_PASSWORD ?? "password";
  const passwordHash = await hashPassword(password);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  try {
    for (const user of users) {
      await prisma.user.upsert({
        where: { username: user.username },
        update: { name: user.name, passwordHash, kind: "HUMAN" },
        create: { name: user.name, username: user.username, passwordHash, kind: "HUMAN" },
      });
    }
  } finally {
    await prisma.$disconnect();
  }

  const names = users.map((user) => user.username).join(", ");
  if (process.env.SEED_PASSWORD) {
    console.log(`Seeded ${names}. Sign in with SEED_PASSWORD.`);
  } else {
    console.log(`Seeded ${names}. Sign in with password.`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
