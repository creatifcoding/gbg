import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: __dirname,
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
    globals: false,
  },
})
