/**
 * Session Event Schemas — for EventLog + PubSub
 *
 * Write-side events that get persisted (via EventLog) and broadcast (via PubSub).
 * These are the event-sourcing events — NOT the lifecycle transitions.
 *
 * Lifecycle transitions → lifecycle.ts (state machine input)
 * Session events → events.ts (persisted domain events)
 *
 * @module harness/session/v2/events
 */

import { Schema } from 'effect'
import { HarnessSessionId, EntryId } from './identity'
import type { SessionEntry } from './entries'
import type { SessionMetadata } from './metadata'
import type { SessionLifecycleState } from './lifecycle'

// =============================================================================
// Session Domain Events
// =============================================================================

/** A new session was created */
export const SessionCreated = Schema.TaggedStruct('SessionCreated', {
  sessionId: HarnessSessionId,
  timestamp: Schema.String.pipe(Schema.nonEmptyString()),
  cwd: Schema.String,
})
export type SessionCreated = typeof SessionCreated.Type

/** A session was resumed from persistence */
export const SessionResumed = Schema.TaggedStruct('SessionResumed', {
  sessionId: HarnessSessionId,
  timestamp: Schema.String.pipe(Schema.nonEmptyString()),
  entryCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
export type SessionResumed = typeof SessionResumed.Type

/** An entry was appended to the session tree */
export const EntryAppended = Schema.TaggedStruct('EntryAppended', {
  sessionId: HarnessSessionId,
  entryId: EntryId,
  entryTag: Schema.String,
  parentId: Schema.NullOr(EntryId),
  timestamp: Schema.String.pipe(Schema.nonEmptyString()),
})
export type EntryAppended = typeof EntryAppended.Type

/** A branch was created (leaf pointer moved) */
export const BranchCreated = Schema.TaggedStruct('BranchCreated', {
  sessionId: HarnessSessionId,
  fromEntryId: EntryId,
  timestamp: Schema.String.pipe(Schema.nonEmptyString()),
})
export type BranchCreated = typeof BranchCreated.Type

/** Compaction was performed */
export const CompactionPerformed = Schema.TaggedStruct('CompactionPerformed', {
  sessionId: HarnessSessionId,
  compactionEntryId: EntryId,
  firstKeptEntryId: EntryId,
  tokensBefore: Schema.Number.pipe(Schema.nonNegative()),
  timestamp: Schema.String.pipe(Schema.nonEmptyString()),
})
export type CompactionPerformed = typeof CompactionPerformed.Type

/** Session was forked into a new session */
export const SessionForked = Schema.TaggedStruct('SessionForked', {
  sourceSessionId: HarnessSessionId,
  targetSessionId: HarnessSessionId,
  forkEntryId: EntryId,
  timestamp: Schema.String.pipe(Schema.nonEmptyString()),
})
export type SessionForked = typeof SessionForked.Type

/** Session was disposed */
export const SessionDisposed = Schema.TaggedStruct('SessionDisposed', {
  sessionId: HarnessSessionId,
  reason: Schema.optional(Schema.String),
  timestamp: Schema.String.pipe(Schema.nonEmptyString()),
})
export type SessionDisposed = typeof SessionDisposed.Type

/** Session metadata was updated */
export const MetadataUpdated = Schema.TaggedStruct('MetadataUpdated', {
  sessionId: HarnessSessionId,
  field: Schema.String,
  timestamp: Schema.String.pipe(Schema.nonEmptyString()),
})
export type MetadataUpdated = typeof MetadataUpdated.Type

// =============================================================================
// Session Event Union
// =============================================================================

/**
 * All session domain events.
 *
 * Used for:
 * - PubSub broadcast to reactive consumers
 * - EventLog persistence (Phase 2)
 * - Audit trail
 */
export const SessionEvent = Schema.Union(
  SessionCreated,
  SessionResumed,
  EntryAppended,
  BranchCreated,
  CompactionPerformed,
  SessionForked,
  SessionDisposed,
  MetadataUpdated,
)
export type SessionEvent = typeof SessionEvent.Type

/** All event tags for exhaustive matching */
export const SESSION_EVENT_TAGS = [
  'SessionCreated',
  'SessionResumed',
  'EntryAppended',
  'BranchCreated',
  'CompactionPerformed',
  'SessionForked',
  'SessionDisposed',
  'MetadataUpdated',
] as const
export type SessionEventTag = (typeof SESSION_EVENT_TAGS)[number]
