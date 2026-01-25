/**
 * TMNL PTY Library
 *
 * Effect-native PTY session management with WebSocket relay.
 *
 * ## Architecture
 *
 * - **PtyBackend**: Abstract PTY interface (swappable: bun-pty → Bun.Terminal)
 * - **PtySessionManager**: Multi-session lifecycle management
 * - **PtyServer**: WebSocket relay using Effect Platform
 *
 * ## Usage
 *
 * ```ts
 * // Start the PTY relay server
 * import { runPtyServer } from '@/lib/pty'
 * import { BunRuntime } from '@effect/platform-bun'
 *
 * BunRuntime.runMain(runPtyServer)
 * ```
 *
 * ## Client Connection
 *
 * ```ts
 * // Connect from GhosttyTerminal
 * const ws = new WebSocket('ws://localhost:7681/ws?shell=bash&cols=80&rows=24')
 *
 * ws.onmessage = (e) => {
 *   const msg = JSON.parse(e.data)
 *   if (msg._tag === 'ServerData') {
 *     terminal.write(msg.data)
 *   }
 * }
 *
 * // Send input
 * ws.send(JSON.stringify({ _tag: 'ClientData', data: 'ls -la\n' }))
 *
 * // Resize
 * ws.send(JSON.stringify({ _tag: 'ClientResize', cols: 120, rows: 40 }))
 * ```
 */

// Schemas
export {
  SessionId,
  PtyConfig,
  ClientData,
  ClientResize,
  ClientPing,
  ClientMessage,
  ServerData,
  ServerReady,
  ServerExit,
  ServerError,
  ServerPong,
  ServerMessage,
  SessionStatus,
  SessionInfo,
} from './schemas'
export type {
  SessionId as SessionIdType,
  PtyConfig as PtyConfigType,
  ClientMessage as ClientMessageType,
  ServerMessage as ServerMessageType,
  SessionInfo as SessionInfoType,
} from './schemas'

// Services
export {
  PtyBackend,
  BunPtyBackendLive,
  PtySpawnError,
  PtyWriteError,
} from './services/PtyBackend'
export type { PtyHandle, PtyBackendShape } from './services/PtyBackend'

export {
  PtySessionManager,
  PtySessionManagerLive,
} from './services/PtySessionManager'
export type { PtySessionManagerShape } from './services/PtySessionManager'

// Server
export { PtyServerLive, runPtyServer } from './server'
