import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["bun:sqlite"],
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Sequential execution for integration tests to avoid DB race conditions
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    exclude: [
      "**/node_modules/**",
      "**/*.bun.test.ts", // Bun-specific tests (use bun:sqlite) - run with `bun test`
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/lib/layers/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/__tests__/**",
        "**/types.ts",
      ],
      all: true,
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
    // Benchmark configuration
    benchmark: {
      include: ["src/**/*.bench.{ts,tsx}"],
      exclude: ["**/node_modules/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@selfcharters/sparkplug-client": path.resolve(__dirname, "../sparkplug-client/src/index.ts"),
    },
  },
});
