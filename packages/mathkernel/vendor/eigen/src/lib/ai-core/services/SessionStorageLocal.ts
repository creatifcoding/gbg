/**
 * Local Storage Implementation of SessionStorage
 *
 * Default browser-side storage using localStorage.
 * Stores sessions with the following key scheme:
 * - ai-core:sessions:index - Array of SessionMetadata (for fast listing)
 * - ai-core:session:{id} - Full Session data
 * - ai-core:sessions:active - Currently active session ID
 *
 * Limitations:
 * - ~5MB total localStorage limit
 * - Single device only (no sync)
 * - Synchronous API (wrapped in Effect.sync)
 */

import { Effect, Layer, Schema } from 'effect'
import { SessionStorage } from './SessionStorage'
import {
  Session,
  SessionMetadata,
  SessionFromJson,
  SessionMetadataFromJson,
  type SessionId,
} from '../schemas/session'

// =============================================================================
// Storage Keys
// =============================================================================

const SESSIONS_INDEX_KEY = 'ai-core:sessions:index'
const SESSION_PREFIX = 'ai-core:session:'
const ACTIVE_SESSION_KEY = 'ai-core:sessions:active'

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Safely parse JSON with fallback
 */
const safeJsonParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/**
 * Convert stored JSON to SessionMetadata
 */
const parseStoredMetadata = (data: unknown): SessionMetadata | null => {
  const result = Schema.decodeUnknownSync(SessionMetadataFromJson)(data)
  return new SessionMetadata({
    id: result.id as SessionId,
    title: result.title,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  })
}

/**
 * Convert stored JSON to Session
 */
const parseStoredSession = (data: unknown): Session | null => {
  try {
    const result = Schema.decodeUnknownSync(SessionFromJson)(data)
    return new Session({
      id: result.id as SessionId,
      title: result.title,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      systemPrompt: result.systemPrompt,
      model: result.model,
      temperature: result.temperature,
      toolsEnabled: result.toolsEnabled,
      messages: result.messages,
    })
  } catch {
    return null
  }
}

/**
 * Convert Session to storable JSON
 */
const sessionToJson = (session: Session): object => ({
  id: session.id,
  title: session.title,
  createdAt: session.createdAt.toISOString(),
  updatedAt: session.updatedAt.toISOString(),
  systemPrompt: session.systemPrompt,
  model: session.model,
  temperature: session.temperature,
  toolsEnabled: session.toolsEnabled,
  messages: session.messages,
})

/**
 * Convert SessionMetadata to storable JSON
 */
const metadataToJson = (metadata: SessionMetadata): object => ({
  id: metadata.id,
  title: metadata.title,
  createdAt: metadata.createdAt.toISOString(),
  updatedAt: metadata.updatedAt.toISOString(),
})

// =============================================================================
// LocalStorage Implementation
// =============================================================================

const makeSessionStorageLocal = (): SessionStorage['Type'] => ({
  list: () =>
    Effect.sync(() => {
      const raw = localStorage.getItem(SESSIONS_INDEX_KEY)
      const parsed = safeJsonParse<unknown[]>(raw, [])

      return parsed
        .map((item) => {
          try {
            return parseStoredMetadata(item)
          } catch {
            return null
          }
        })
        .filter((m): m is SessionMetadata => m !== null)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    }),

  load: (id) =>
    Effect.sync(() => {
      const raw = localStorage.getItem(`${SESSION_PREFIX}${id}`)
      if (!raw) return null

      const parsed = safeJsonParse<unknown>(raw, null)
      if (!parsed) return null

      return parseStoredSession(parsed)
    }),

  save: (session) =>
    Effect.sync(() => {
      // Save full session
      localStorage.setItem(
        `${SESSION_PREFIX}${session.id}`,
        JSON.stringify(sessionToJson(session))
      )

      // Update index
      const raw = localStorage.getItem(SESSIONS_INDEX_KEY)
      const index = safeJsonParse<unknown[]>(raw, [])

      // Find existing or prepare to add
      const existingIndex = index.findIndex(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          'id' in item &&
          (item as { id: unknown }).id === session.id
      )

      const metadata = new SessionMetadata({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: new Date(), // Always update on save
      })

      const metadataJson = metadataToJson(metadata)

      if (existingIndex >= 0) {
        index[existingIndex] = metadataJson
      } else {
        index.unshift(metadataJson)
      }

      localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(index))
    }),

  delete: (id) =>
    Effect.sync(() => {
      // Remove full session
      localStorage.removeItem(`${SESSION_PREFIX}${id}`)

      // Update index
      const raw = localStorage.getItem(SESSIONS_INDEX_KEY)
      const index = safeJsonParse<unknown[]>(raw, [])

      const filtered = index.filter(
        (item) =>
          !(
            typeof item === 'object' &&
            item !== null &&
            'id' in item &&
            (item as { id: unknown }).id === id
          )
      )

      localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(filtered))

      // Clear active if this was active session
      const activeId = localStorage.getItem(ACTIVE_SESSION_KEY)
      if (activeId === id) {
        localStorage.removeItem(ACTIVE_SESSION_KEY)
      }
    }),

  search: (query) =>
    Effect.sync(() => {
      const raw = localStorage.getItem(SESSIONS_INDEX_KEY)
      const parsed = safeJsonParse<unknown[]>(raw, [])
      const q = query.toLowerCase()

      return parsed
        .map((item) => {
          try {
            return parseStoredMetadata(item)
          } catch {
            return null
          }
        })
        .filter((m): m is SessionMetadata => m !== null)
        .filter((m) => m.title.toLowerCase().includes(q))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    }),

  getActiveId: () =>
    Effect.sync(() => localStorage.getItem(ACTIVE_SESSION_KEY)),

  setActiveId: (id) =>
    Effect.sync(() => {
      if (id) {
        localStorage.setItem(ACTIVE_SESSION_KEY, id)
      } else {
        localStorage.removeItem(ACTIVE_SESSION_KEY)
      }
    }),
})

// =============================================================================
// Layer Export
// =============================================================================

/**
 * Layer providing localStorage-based SessionStorage implementation.
 *
 * @example
 * // Use as default storage:
 * const program = Effect.gen(function* () {
 *   const storage = yield* SessionStorage
 *   return yield* storage.list()
 * })
 *
 * Effect.runPromise(
 *   Effect.provide(program, SessionStorageLocalLive)
 * )
 */
export const SessionStorageLocalLive = Layer.succeed(
  SessionStorage,
  makeSessionStorageLocal()
)
