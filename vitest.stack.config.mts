import { defineConfig } from "vitest/config";
import path from "node:path";

// Tests that need the running local Supabase stack. Not part of `npm test`.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: { environment: "node", include: ["tests/stack/**/*.test.ts"], testTimeout: 30000 },
});
