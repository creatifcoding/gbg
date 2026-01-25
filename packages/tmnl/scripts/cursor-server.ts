#!/usr/bin/env bun
/**
 * Cursor Chat Server
 *
 * Run with: bun run scripts/cursor-server.ts
 * Or via npm script: bun run cursor:server
 *
 * Endpoints:
 * - GET  /health  - Health check
 * - POST /chat    - Chat endpoint (SSE stream)
 *
 * Prerequisites:
 * - Claude Code CLI authenticated: `claude login`
 */

import { BunRuntime } from '@effect/platform-bun'
import { Effect, Layer } from 'effect'
import { CursorChatServerLive, runCursorChatServer } from '../src/lib/cursor/api/server'

const program = Effect.gen(function* () {
  yield* runCursorChatServer
  yield* Layer.launch(CursorChatServerLive)
})

BunRuntime.runMain(program)
