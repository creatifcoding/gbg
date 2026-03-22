import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@tmnl/mathkernel/wasm": path.resolve(__dirname, "../mathkernel/dist/mathkernel.js"),
      "@tmnl/mathkernel": path.resolve(__dirname, "../mathkernel/dist/index.js"),
    },
  },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "happy-dom",
    globals: false,
  },
})
