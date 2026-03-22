/**
 * Terminal Backend Module
 *
 * Provides swappable terminal backends via Effect Layers:
 * - PtyBackendLive: Local shell via bun-pty
 * - SshBackendLive: Remote shell via ssh2
 *
 * Usage:
 * ```typescript
 * import {
 *   TerminalSessionManagerLive,
 *   PtyBackendLive,
 *   SshBackendLive
 * } from './backend'
 *
 * // Compose session manager with PTY backend
 * const PtySessionLayer = TerminalSessionManagerLive.pipe(
 *   Layer.provide(PtyBackendLive)
 * )
 *
 * // Compose session manager with SSH backend
 * const SshSessionLayer = TerminalSessionManagerLive.pipe(
 *   Layer.provide(SshBackendLive)
 * )
 *
 * // Server uses whichever layer you provide
 * const PtyServerLive = ServerLive.pipe(Layer.provide(PtySessionLayer))
 * const SshServerLive = ServerLive.pipe(Layer.provide(SshSessionLayer))
 * ```
 */

// Schemas
export * from './schemas'

// Abstract interface
export {
  TerminalBackend,
  type TerminalBackendShape,
  type TerminalHandle,
  type TerminalExit,
  TerminalConnectError,
  TerminalWriteError,
  TerminalResizeError,
  TerminalStreamError,
} from './TerminalBackend'

// Session Manager (backend-agnostic)
export {
  TerminalSessionManager,
  TerminalSessionManagerLive,
  type TerminalSessionManagerShape,
} from './TerminalSessionManager'

// Concrete backend implementations (Layers)
export { PtyBackendLive } from './PtyBackend'
export { SshBackendLive } from './SshBackend'

// Server
export { TerminalServerLive, runTerminalServer } from './server'

// ─────────────────────────────────────────────────────────────────────────────
// Pre-composed Layers for convenience
// ─────────────────────────────────────────────────────────────────────────────

import { Layer } from 'effect'
import { TerminalSessionManagerLive } from './TerminalSessionManager'
import { PtyBackendLive } from './PtyBackend'
import { SshBackendLive } from './SshBackend'
import { TerminalServerLive } from './server'

/** Session manager with PTY backend */
export const PtySessionLayer = TerminalSessionManagerLive.pipe(
  Layer.provide(PtyBackendLive)
)

/** Session manager with SSH backend */
export const SshSessionLayer = TerminalSessionManagerLive.pipe(
  Layer.provide(SshBackendLive)
)

/** Complete PTY server stack */
export const PtyServerLive = TerminalServerLive.pipe(
  Layer.provide(PtySessionLayer)
)

/** Complete SSH server stack */
export const SshServerLive = TerminalServerLive.pipe(
  Layer.provide(SshSessionLayer)
)
