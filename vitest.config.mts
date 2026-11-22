import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/db/**/*.test.ts"],
    testTimeout: 60000,
    // Each DB test file boots its own in-process Postgres (PGlite); several in parallel can exceed the 10s default.
    hookTimeout: 90000,
  },
});
