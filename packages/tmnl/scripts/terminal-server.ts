#!/usr/bin/env bun
/**
 * Terminal WebSocket Relay Server
 *
 * Demonstrates Layer.provide for backend swapping:
 * - Same server code
 * - Different backends via Layer composition
 *
 * Usage:
 *   bun run scripts/terminal-server.ts [--pty | --ssh]
 */

import { Effect, Layer } from 'effect'
import {
  TerminalServerLive,
  PtySessionLayer,
  SshSessionLayer,
  runTerminalServer,
} from '../src/lib/terminal/backend'

// ─────────────────────────────────────────────────────────────────────────────
// Parse CLI args
// ─────────────────────────────────────────────────────────────────────────────

const mode = process.argv.includes('--ssh') ? 'ssh' : 'pty'

// ─────────────────────────────────────────────────────────────────────────────
// Compose Layers based on mode
// ─────────────────────────────────────────────────────────────────────────────

// Layer.provide: ServerLive depends on SessionLayer
// SessionLayer already has the backend baked in via Layer.provide in index.ts
const ServerWithBackend = TerminalServerLive.pipe(
  Layer.provide(mode === 'ssh' ? SshSessionLayer : PtySessionLayer)
)

// ─────────────────────────────────────────────────────────────────────────────
// Launch
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`)
console.log(`  TMNL Terminal Server`)
console.log(`  Backend: ${mode.toUpperCase()}`)
console.log(`${'='.repeat(60)}\n`)

// Layer.launch runs the layer and keeps it alive
Effect.runPromise(
  Layer.launch(ServerWithBackend).pipe(
    Effect.tap(() => runTerminalServer),
    Effect.catchAllCause((cause) => {
      console.error('Server error:', cause)
      return Effect.void
    })
  )
).catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
