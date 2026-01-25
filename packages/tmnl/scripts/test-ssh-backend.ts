#!/usr/bin/env bun
/**
 * Test SSH Backend with Layer Swap
 *
 * Demonstrates that the same program can run with either PTY or SSH backend.
 * Just swap the Layer!
 *
 * Usage:
 *   bun run scripts/test-ssh-backend.ts [--pty | --ssh]
 */

import { Effect, Stream, Layer, Scope } from 'effect'
import {
  TerminalBackend,
  PtyBackendLive,
  SshBackendLive,
  PtyConfig,
  SshConfig,
} from '../src/lib/terminal/backend'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// TMNL dedicated SSH key
const TMNL_KEY_PATH = join(homedir(), '.ssh', 'tmnl_localhost')

// ─────────────────────────────────────────────────────────────────────────────
// The Program (backend-agnostic!)
// ─────────────────────────────────────────────────────────────────────────────

const runTerminalTest = (configType: 'pty' | 'ssh') =>
  Effect.gen(function* () {
    const backend = yield* TerminalBackend

    console.log(`[Test] Using ${backend.type} backend`)

    // Build config based on type
    const config =
      configType === 'pty'
        ? { shell: 'bash', cols: 80, rows: 24 }
        : {
            host: 'localhost',
            port: 2222,  // NixOS SSH on non-standard port (avoids Windows SSH on 22)
            username: process.env.USER ?? 'root',
            auth: {
              _tag: 'PrivateKey' as const,
              privateKey: readFileSync(TMNL_KEY_PATH, 'utf-8'),
            },
            cols: 80,
            rows: 24,
          }

    // Connect (scoped - auto-cleanup)
    const handle = yield* Effect.scoped(
      Effect.gen(function* () {
        console.log(`[Test] Connecting...`)
        const h = yield* backend.connect(config)
        console.log(`[Test] Connected! ID: ${h.id}, Backend: ${h.backend}`)
        if (h.pid) console.log(`[Test] PID: ${h.pid}`)

        // Fork output consumer
        const outputFiber = yield* Effect.fork(
          h.output.pipe(
            Stream.take(5), // Just take first 5 chunks
            Stream.runForEach((data) =>
              Effect.sync(() => {
                const preview = data.slice(0, 100).replace(/\r\n/g, '\\r\\n')
                console.log(`[Output] ${preview}`)
              })
            )
          )
        )

        // Send a command
        yield* Effect.sleep('500 millis')
        console.log(`[Test] Sending 'echo LAYER_SWAP_WORKS'`)
        yield* h.write('echo LAYER_SWAP_WORKS\n')

        // Wait for output
        yield* Effect.sleep('1 second')

        // Send exit
        console.log(`[Test] Sending 'exit'`)
        yield* h.write('exit\n')

        // Wait for exit
        const exit = yield* h.exited.pipe(Effect.timeout('3 seconds'), Effect.option)
        if (exit._tag === 'Some') {
          console.log(`[Test] Exited with code: ${exit.value.exitCode}`)
        } else {
          console.log(`[Test] Timeout waiting for exit`)
        }

        return h
      })
    )

    console.log(`[Test] Scope closed, resources cleaned up`)
  })

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const mode = process.argv.includes('--ssh') ? 'ssh' : 'pty'
const backendLayer = mode === 'ssh' ? SshBackendLive : PtyBackendLive

console.log(`\n${'='.repeat(60)}`)
console.log(`  Terminal Backend Test: ${mode.toUpperCase()}`)
console.log(`${'='.repeat(60)}\n`)

Effect.runPromise(
  runTerminalTest(mode).pipe(
    Effect.provide(backendLayer),
    Effect.catchAll((e) => {
      console.error(`[Error]`, e)
      return Effect.void
    })
  )
)
  .then(() => {
    console.log(`\n[Test] Complete!`)
    process.exit(0)
  })
  .catch((e) => {
    console.error(`[Fatal]`, e)
    process.exit(1)
  })
