import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: [
      { find: "@tmnl/pct", replacement: path.resolve(__dirname, "src/index.ts") },
      { find: "@tmnl/msh/diagnostics", replacement: path.resolve(__dirname, "../msh/src/diagnostics/index.ts") },
      { find: "@tmnl/msh/nats", replacement: path.resolve(__dirname, "../msh/src/nats/index.ts") },
      { find: "@tmnl/msh", replacement: path.resolve(__dirname, "../msh/src/index.ts") },
      { find: "@tmnl/lnk/contracts", replacement: path.resolve(__dirname, "../lnk/src/contracts/index.ts") },
      { find: "@tmnl/lnk/services/wire/in-memory", replacement: path.resolve(__dirname, "../lnk/src/services/wire/in-memory/index.ts") },
      { find: "@tmnl/lnk/services/wire", replacement: path.resolve(__dirname, "../lnk/src/services/wire/index.ts") },
      { find: "@tmnl/lnk/services", replacement: path.resolve(__dirname, "../lnk/src/services/index.ts") },
      { find: "@tmnl/lnk", replacement: path.resolve(__dirname, "../lnk/src/index.ts") },
    ],
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
