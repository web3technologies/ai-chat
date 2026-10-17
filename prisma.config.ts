import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "src/backend/db/prisma/schema.prisma",
  migrations: {
    path: "src/backend/db/prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
