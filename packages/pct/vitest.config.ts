import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@tmnl/pct": path.resolve(__dirname, "src/index.ts"),
      "@tmnl/lnk": path.resolve(__dirname, "../lnk/src/index.ts"),
    },
  },
  test: {
    globals: false,
    include: ["test/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: ["default"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/index.ts", "src/**/*.test.ts"],
    },
  },
})
