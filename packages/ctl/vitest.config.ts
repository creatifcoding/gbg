import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: false,
    include: ["test/**/*.test.ts"],
    // Exclude bun-specific tests (run with `bun test` instead)
    exclude: ["test/**/*.bun-test.ts", "**/node_modules/**"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
