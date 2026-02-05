/**
 * Session Service
 *
 * Business logic for chat session management.
 * CRUD operations, session forking, import/export.
 *
 * Depends on SessionStorage for persistence (injected via Context.Tag).
 *
 * @example
 * ```typescript
 * import { SessionService, SessionStorageLocalLive } from '@/lib/ai-core/services'
 *
 * const program = Effect.gen(function* () {
 *   const sessions = yield* SessionService
 *   const newSession = yield* sessions.create()
 *   return newSession
 * }).pipe(
 *   Effect.provide(SessionServiceLive),
 *   Effect.provide(SessionStorageLocalLive)
 * )
 * ```
 */

import { Context, Effect, Layer } from 'effect'
import { SessionStorage } from './SessionStorage'
import {
  Session,
  SessionMetadata,
  createSession,
  generateTitleFromMessages,
  toMetadata,
  type SessionId,
  type SessionConfigType,
} from '../schemas/session'

// =============================================================================
// Service Shape
// =============================================================================

/**
 * SessionService interface
 */
export interface SessionServiceShape {
  /**
   * Create a new session
   * Sets it as the active session
   */
  readonly create: (config?: SessionConfigType) => Effect.Effect<Session>

  /**
   * Load session and set as active
   * Returns null if not found
   */
  readonly open: (id: string) => Effect.Effect<Session | null>

  /**
   * Update session fields
   * Auto-updates updatedAt timestamp
   */
  readonly update: (
    id: string,
    updates: Partial<Omit<Session, 'id' | 'createdAt'>>
  ) => Effect.Effect<Session | null>

  /**
   * Append a message to a session
   * Auto-updates updatedAt timestamp
   */
  readonly appendMessage: (id: string, message: unknown) => Effect.Effect<Session | null>

  /**
   * Auto-generate title from first user message
   * Only updates if current title is "New Chat"
   */
  readonly generateTitle: (id: string) => Effect.Effect<Session | null>

  /**
   * Rename session
   */
  readonly rename: (id: string, title: string) => Effect.Effect<Session | null>

  /**
   * Fork session (duplicate with new ID)
   * New session becomes active
   */
  readonly fork: (id: string) => Effect.Effect<Session | null>

  /**
   * Delete session
   * Clears active session if deleted
   */
  readonly delete: (id: string) => Effect.Effect<void>

  /**
   * Export session as JSON string
   */
  readonly export: (id: string) => Effect.Effect<string | null>

  /**
   * Import session from JSON string
   * Creates with new ID to avoid conflicts
   */
  readonly import: (json: string) => Effect.Effect<Session>

  /**
   * List all sessions (metadata only)
   */
  readonly list: () => Effect.Effect<SessionMetadata[]>

  /**
   * Search sessions by title
   */
  readonly search: (query: string) => Effect.Effect<SessionMetadata[]>

  /**
   * Get currently active session (full data)
   */
  readonly getActive: () => Effect.Effect<Session | null>

  /**
   * Get currently active session ID
   */
  readonly getActiveId: () => Effect.Effect<string | null>

  /**
   * Set active session by ID
   */
  readonly setActive: (id: string | null) => Effect.Effect<void>
}

// =============================================================================
// Service Definition
// =============================================================================

/**
 * SessionService Context.Tag
 */
export class SessionService extends Context.Tag('ai-core/SessionService')<
  SessionService,
  SessionServiceShape
>() {}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Create SessionService implementation from storage
 */
const createSessionServiceShape = (storage: SessionStorage['Type']): SessionServiceShape => ({
  create: (config) =>
    Effect.gen(function* () {
      const session = createSession(config)
      yield* storage.save(session)
      yield* storage.setActiveId(session.id)
      return session
    }),

  open: (id) =>
    Effect.gen(function* () {
      const session = yield* storage.load(id)
      if (session) {
        yield* storage.setActiveId(id)
      }
      return session
    }),

  update: (id, updates) =>
    Effect.gen(function* () {
      const session = yield* storage.load(id)
      if (!session) return null

      const updated = new Session({
        ...session,
        ...updates,
        id: session.id, // Preserve original ID
        createdAt: session.createdAt, // Preserve original createdAt
        updatedAt: new Date(),
      })

      yield* storage.save(updated)
      return updated
    }),

  appendMessage: (id, message) =>
    Effect.gen(function* () {
      const session = yield* storage.load(id)
      if (!session) return null

      const updated = new Session({
        ...session,
        messages: [...session.messages, message],
        updatedAt: new Date(),
      })

      yield* storage.save(updated)
      return updated
    }),

  generateTitle: (id) =>
    Effect.gen(function* () {
      const session = yield* storage.load(id)
      if (!session || session.messages.length === 0) return null

      // Only auto-title if still default
      if (session.title !== 'New Chat') return session

      const title = generateTitleFromMessages(session.messages)
      if (!title) return session

      const updated = new Session({
        ...session,
        title,
        updatedAt: new Date(),
      })

      yield* storage.save(updated)
      return updated
    }),

  rename: (id, title) =>
    Effect.gen(function* () {
      const session = yield* storage.load(id)
      if (!session) return null

      const updated = new Session({
        ...session,
        title,
        updatedAt: new Date(),
      })

      yield* storage.save(updated)
      return updated
    }),

  fork: (id) =>
    Effect.gen(function* () {
      const session = yield* storage.load(id)
      if (!session) return null

      const forked = new Session({
        ...session,
        id: crypto.randomUUID() as SessionId,
        title: `${session.title} (fork)`,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      yield* storage.save(forked)
      yield* storage.setActiveId(forked.id)
      return forked
    }),

  delete: (id) =>
    Effect.gen(function* () {
      yield* storage.delete(id)

      // Clear active if this was the active session
      const activeId = yield* storage.getActiveId()
      if (activeId === id) {
        yield* storage.setActiveId(null)
      }
    }),

  export: (id) =>
    Effect.gen(function* () {
      const session = yield* storage.load(id)
      if (!session) return null

      return JSON.stringify(
        {
          id: session.id,
          title: session.title,
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString(),
          systemPrompt: session.systemPrompt,
          model: session.model,
          temperature: session.temperature,
          toolsEnabled: session.toolsEnabled,
          messages: session.messages,
        },
        null,
        2
      )
    }),

  import: (json) =>
    Effect.gen(function* () {
      const parsed = JSON.parse(json) as {
        title?: string
        systemPrompt?: string
        model?: string
        temperature?: number
        toolsEnabled?: string[]
        messages?: unknown[]
      }

      // Create new session with imported data but new ID
      const session = new Session({
        id: crypto.randomUUID() as SessionId,
        title: parsed.title ?? 'Imported Chat',
        createdAt: new Date(),
        updatedAt: new Date(),
        systemPrompt: parsed.systemPrompt,
        model: parsed.model,
        temperature: parsed.temperature,
        toolsEnabled: parsed.toolsEnabled,
        messages: parsed.messages ?? [],
      })

      yield* storage.save(session)
      yield* storage.setActiveId(session.id)
      return session
    }),

  list: () => storage.list(),

  search: (query) => storage.search(query),

  getActive: () =>
    Effect.gen(function* () {
      const id = yield* storage.getActiveId()
      if (!id) return null
      return yield* storage.load(id)
    }),

  getActiveId: () => storage.getActiveId(),

  setActive: (id) => storage.setActiveId(id),
})

// =============================================================================
// Layer
// =============================================================================

/**
 * SessionService layer that depends on SessionStorage
 */
export const SessionServiceLive = Layer.effect(
  SessionService,
  Effect.gen(function* () {
    const storage = yield* SessionStorage
    return createSessionServiceShape(storage)
  })
)

// =============================================================================
// Convenience Export
// =============================================================================

export const SessionServiceModule = {
  /**
   * Layer requiring SessionStorage
   */
  Live: SessionServiceLive,

  /**
   * Create a custom session config
   */
  config: (opts: SessionConfigType) => opts,
}
