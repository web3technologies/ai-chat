import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const alias = {
  "@": path.join(root, "src"),
  "server-only": path.join(root, "tests/stubs/server-only.ts"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "backend",
          environment: "node",
          include: ["tests/backend/**/*.test.ts"],
          env: {
            DATABASE_URL: "postgresql://test:test@localhost:5432/test",
            JWT_SECRET: "test-secret",
          },
        },
      },
      {
        resolve: { alias },
        test: {
          name: "frontend",
          environment: "jsdom",
          include: ["tests/frontend/**/*.test.ts", "tests/frontend/**/*.test.tsx"],
          setupFiles: ["tests/setup.ts"],
        },
      },
    ],
  },
});
