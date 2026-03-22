/**
 * Content Persistence — Effect-native content durability ring.
 *
 * Uses `@effect/platform-browser` KeyValueStore + Effect Schema for
 * type-safe write-through persistence of chat messages.
 *
 * Architecture:
 *   messages$ atom ──write-through──▶ KeyValueStore (localStorage)
 *   mount ──hydrate──▶ messages$ atom
 *
 * Key format: `morphchat:content:${instanceId}`
 * TTL: 24 hours (stale content evicted on hydration)
 */

import { Schema } from 'effect'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import { KeyValueStore } from '@effect/platform'
import { BrowserKeyValueStore } from '@effect/platform-browser'
import { ChatMessage } from '../schemas/message-types'

// =============================================================================
// Content Snapshot Schema
// =============================================================================

/** Persisted content snapshot for a single morphchat instance */
export const ContentSnapshot = Schema.Struct({
  /** Instance ID this snapshot belongs to */
  instanceId: Schema.String,
  /** Session ID at time of snapshot (for staleness detection) */
  sessionId: Schema.NullOr(Schema.String),
  /** Persisted messages */
  messages: Schema.Array(ChatMessage),
  /** Message ID ordering */
  messageIds: Schema.Array(Schema.String),
  /** Timestamp of last write (epoch ms) */
  savedAt: Schema.Number,
})
export type ContentSnapshot = typeof ContentSnapshot.Type

/** TTL for persisted content — 24 hours */
const CONTENT_TTL_MS = 24 * 60 * 60 * 1000

/** Key prefix for content snapshots */
const KEY_PREFIX = 'morphchat:content:'

// =============================================================================
// Content Store Service
// =============================================================================

/** Encode a ContentSnapshot to a JSON string for storage */
const encodeSnapshot = Schema.encode(Schema.parseJson(ContentSnapshot))

/** Decode a JSON string back to a ContentSnapshot */
const decodeSnapshot = Schema.decode(Schema.parseJson(ContentSnapshot))

/**
 * Write content snapshot to storage.
 * Called on every message update (debounced by caller).
 */
export const writeContent = (
  instanceId: string,
  sessionId: string | null,
  messages: ReadonlyArray<typeof ChatMessage.Type>,
  messageIds: ReadonlyArray<string>,
): Effect.Effect<void, never, KeyValueStore.KeyValueStore> =>
  Effect.gen(function* () {
    const store = yield* KeyValueStore.KeyValueStore
    const snapshot: ContentSnapshot = {
      instanceId,
      sessionId,
      messages: [...messages],
      messageIds: [...messageIds],
      savedAt: Date.now(),
    }
    const encoded = yield* encodeSnapshot(snapshot).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )
    if (encoded) {
      yield* store.set(`${KEY_PREFIX}${instanceId}`, encoded).pipe(
        Effect.catchAll(() => Effect.void),
      )
    }
  })

/**
 * Read content snapshot from storage.
 * Returns None if not found, expired, or corrupt.
 */
export const readContent = (
  instanceId: string,
): Effect.Effect<Option.Option<ContentSnapshot>, never, KeyValueStore.KeyValueStore> =>
  Effect.gen(function* () {
    const store = yield* KeyValueStore.KeyValueStore
    const raw = yield* store.get(`${KEY_PREFIX}${instanceId}`).pipe(
      Effect.catchAll(() => Effect.succeed(Option.none<string>())),
    )

    if (Option.isNone(raw)) return Option.none<ContentSnapshot>()

    const snapshot = yield* decodeSnapshot(raw.value).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )

    if (!snapshot) return Option.none<ContentSnapshot>()

    // TTL check — evict stale snapshots
    if (Date.now() - snapshot.savedAt > CONTENT_TTL_MS) {
      yield* store.remove(`${KEY_PREFIX}${instanceId}`).pipe(
        Effect.catchAll(() => Effect.void),
      )
      return Option.none<ContentSnapshot>()
    }

    return Option.some(snapshot)
  })

/**
 * Remove content snapshot from storage.
 */
export const clearContent = (
  instanceId: string,
): Effect.Effect<void, never, KeyValueStore.KeyValueStore> =>
  Effect.gen(function* () {
    const store = yield* KeyValueStore.KeyValueStore
    yield* store.remove(`${KEY_PREFIX}${instanceId}`).pipe(
      Effect.catchAll(() => Effect.void),
    )
  })

/**
 * The Layer that provides KeyValueStore via localStorage.
 * Use this to provide the service to write/read/clear operations.
 */
export const ContentStoreLive = BrowserKeyValueStore.layerLocalStorage
