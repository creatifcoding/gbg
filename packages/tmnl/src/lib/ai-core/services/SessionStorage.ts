/**
 * Session Storage Interface
 *
 * Abstract storage interface for session persistence.
 * Consumers can inject different implementations:
 * - localStorage (default, browser-side)
 * - IndexedDB (for larger storage)
 * - API-backed (for server-side persistence)
 *
 * Uses Effect Context.Tag for dependency injection.
 */

import { Context, Effect } from 'effect'
import type { Session, SessionMetadata } from '../schemas/session'

// =============================================================================
// Storage Interface
// =============================================================================

/**
 * Abstract storage interface for session persistence.
 *
 * All methods return Effect to allow for async storage backends.
 * Errors are typed as `never` for simplicity - implementations
 * should handle their own error recovery.
 */
export interface SessionStorageShape {
  /**
   * List all sessions (metadata only for performance)
   * Returns sessions sorted by updatedAt descending (most recent first)
   */
  readonly list: () => Effect.Effect<SessionMetadata[]>

  /**
   * Load full session by ID
   * Returns null if session not found
   */
  readonly load: (id: string) => Effect.Effect<Session | null>

  /**
   * Save session (create or update)
   * Upserts based on session.id
   */
  readonly save: (session: Session) => Effect.Effect<void>

  /**
   * Delete session by ID
   * No-op if session doesn't exist
   */
  readonly delete: (id: string) => Effect.Effect<void>

  /**
   * Search sessions by title
   * Case-insensitive partial match on title
   */
  readonly search: (query: string) => Effect.Effect<SessionMetadata[]>

  /**
   * Get current active session ID
   * Returns null if no session is active
   */
  readonly getActiveId: () => Effect.Effect<string | null>

  /**
   * Set current active session ID
   * Pass null to clear active session
   */
  readonly setActiveId: (id: string | null) => Effect.Effect<void>
}

/**
 * Context.Tag for SessionStorage dependency injection.
 *
 * @example
 * // In a service that needs storage:
 * const storage = yield* SessionStorage
 * const sessions = yield* storage.list()
 *
 * @example
 * // Providing a storage implementation:
 * Effect.provide(myEffect, SessionStorageLocalLive)
 */
export class SessionStorage extends Context.Tag('ai-core/SessionStorage')<
  SessionStorage,
  SessionStorageShape
>() {}

// =============================================================================
// Type Exports
// =============================================================================

export type { SessionStorageShape as SessionStorageType }
