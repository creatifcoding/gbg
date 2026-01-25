#!/usr/bin/env bun
/**
 * PTY WebSocket Relay Server
 *
 * Run with: bun run scripts/pty-server.ts
 * Or via npm script: bun run pty:server
 *
 * Endpoints:
 * - GET  /health         - Health check
 * - GET  /sessions       - List active sessions
 * - GET  /ws             - Create new session (WebSocket)
 * - GET  /ws/:sessionId  - Attach to session (WebSocket)
 * - DELETE /sessions/:id - Destroy session
 */

import { BunRuntime } from '@effect/platform-bun'
import { runPtyServer } from '../src/lib/pty'

BunRuntime.runMain(runPtyServer)
