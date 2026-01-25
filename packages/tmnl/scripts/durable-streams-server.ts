/**
 * Durable Streams Server
 *
 * Effect-native HTTP server for durable streams.
 * Uses HttpApi for type-safe endpoints with automatic OpenAPI.
 *
 * Usage: bun run durable:server
 *
 * Features:
 * - SQLite persistence with WAL mode
 * - Automatic migrations
 * - OpenAPI/Swagger documentation at /docs
 * - CORS support
 * - Health check endpoint
 *
 * Environment Variables:
 * - DURABLE_STREAM_PORT (default: 4437)
 * - DURABLE_STREAM_HOST (default: 127.0.0.1)
 * - DURABLE_STREAM_DB (default: ~/.local/share/tmnl/durable-streams.db)
 */

import { Effect, Layer, pipe } from 'effect'
import {
  HttpApiBuilder,
  HttpApiSwagger,
  HttpMiddleware,
  HttpServer,
} from '@effect/platform'
import { BunHttpServer, BunContext } from '@effect/platform-bun'

import {
  DurableStreamsApiLive,
  DurableStreamPersistenceLayer,
  getDbPath,
} from '../src/lib/durable-streams/server'

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.DURABLE_STREAM_PORT ?? '4437', 10)
const HOST = process.env.DURABLE_STREAM_HOST ?? '127.0.0.1'

// ─────────────────────────────────────────────────────────────────────────────
// Server Layer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full server layer stack
 *
 * - HttpApiBuilder.serve with logging middleware
 * - Swagger UI at /docs
 * - OpenAPI spec at /openapi.json
 * - CORS middleware
 * - API handlers
 * - SQLite persistence
 */
const ServerLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  // Swagger UI
  Layer.provide(HttpApiSwagger.layer({ path: '/docs' })),

  // OpenAPI spec middleware
  Layer.provide(HttpApiBuilder.middlewareOpenApi()),

  // API implementation
  Layer.provide(DurableStreamsApiLive),

  // CORS middleware
  Layer.provide(HttpApiBuilder.middlewareCors()),

  // HTTP server logging
  HttpServer.withLogAddress,

  // Bun HTTP server
  Layer.provide(BunHttpServer.layer({ port: PORT, hostname: HOST })),
  Layer.provide(BunContext.layer),

  // SQLite persistence
  Layer.provide(DurableStreamPersistenceLayer)
)

// ─────────────────────────────────────────────────────────────────────────────
// Startup Banner
// ─────────────────────────────────────────────────────────────────────────────

const printBanner = Effect.sync(() => {
  const dbPath = getDbPath()

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              DURABLE STREAMS SERVER (Effect)                   ║
╠═══════════════════════════════════════════════════════════════╣
║  Port:      ${String(PORT).padEnd(48)}║
║  Host:      ${HOST.padEnd(48)}║
║  Database:  ${dbPath.slice(0, 48).padEnd(48)}║
╚═══════════════════════════════════════════════════════════════╝

📡 API Endpoints:
   POST   /v1/stream/:id          - Append to stream (creates if needed)
   GET    /v1/stream/:id          - Read from stream (with offset)
   HEAD   /v1/stream/:id          - Check if stream exists
   DELETE /v1/stream/:id          - Delete stream
   GET    /v1/stream/:id/metadata - Get stream metadata
   GET    /health                 - Health check

📚 Documentation:
   GET    /docs                   - Swagger UI
   GET    /openapi.json           - OpenAPI spec

🔗 For Telegram bot, set:
   DURABLE_STREAM_URL=http://${HOST}:${PORT}
`)
})

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const main = pipe(
  printBanner,
  Effect.flatMap(() =>
    Effect.log(`Starting durable streams server on http://${HOST}:${PORT}`)
  ),
  Effect.flatMap(() => Layer.launch(ServerLive))
)

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

Effect.runPromise(main).catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
