/**
 * Durable Streams Server Events
 *
 * EventLog schema for stream observability.
 * Follows the pattern from src/lib/overlays/events/overlay.ts
 *
 * @module @gbg/tmnl/durable-streams/server/events
 */

import { Schema } from 'effect'
import { EventGroup } from '@effect/experimental'

// ─────────────────────────────────────────────────────────────────────────────
// Stream Events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All durable stream events
 */
export const DurableStreamEvents = EventGroup.empty
  .add({
    tag: 'StreamCreated',
    primaryKey: (p) => p.streamId,
    payload: Schema.Struct({
      streamId: Schema.String,
      contentType: Schema.String,
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: 'StreamDeleted',
    primaryKey: (p) => p.streamId,
    payload: Schema.Struct({
      streamId: Schema.String,
      entryCount: Schema.Number,
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: 'StreamAppended',
    primaryKey: (p) => p.streamId,
    payload: Schema.Struct({
      streamId: Schema.String,
      offset: Schema.Number,
      dataSize: Schema.Number,
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: 'StreamRead',
    primaryKey: (p) => p.streamId,
    payload: Schema.Struct({
      streamId: Schema.String,
      fromOffset: Schema.Number,
      entriesReturned: Schema.Number,
      upToDate: Schema.Boolean,
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: 'StreamError',
    primaryKey: (p) => p.streamId,
    payload: Schema.Struct({
      streamId: Schema.String,
      operation: Schema.Literal('create', 'append', 'read', 'delete'),
      errorType: Schema.String,
      errorMessage: Schema.String,
      timestamp: Schema.Number,
    }),
  })

export type DurableStreamEvents = typeof DurableStreamEvents

// ─────────────────────────────────────────────────────────────────────────────
// Event Type Exports (for handler type inference)
// ─────────────────────────────────────────────────────────────────────────────

export const StreamCreated = DurableStreamEvents.events.StreamCreated
export const StreamDeleted = DurableStreamEvents.events.StreamDeleted
export const StreamAppended = DurableStreamEvents.events.StreamAppended
export const StreamRead = DurableStreamEvents.events.StreamRead
export const StreamError = DurableStreamEvents.events.StreamError
