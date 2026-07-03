import { defineConfig } from "vitest/config"

// Canonical `effect` resolves to v4 monorepo-wide (canonical-path inversion,
// 2026-07-03). The former "effect-v4" resolve alias is retired.

export default defineConfig({
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
