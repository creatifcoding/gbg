/**
 * Pi Session + Multi-Session Schemas
 *
 * Browser-safe data contracts for surfacing pi CLI JSONL sessions inside the
 * TMNL harness without importing Node-only pi SDK code into client bundles.
 *
 * Server-only loading lives in ./pi-session-source.ts.
 */

import { Schema } from 'effect'

// =============================================================================
// Source-neutral session references
// =============================================================================

export const HarnessStoredSessionRef = Schema.TaggedStruct('HarnessStoredSessionRef', {
  id: Schema.String.pipe(Schema.nonEmptyString()),
})
export type HarnessStoredSessionRef = typeof HarnessStoredSessionRef.Type

export const PiCliSessionRef = Schema.TaggedStruct('PiCliSessionRef', {
  /** pi's session header id */
  id: Schema.String.pipe(Schema.nonEmptyString()),
  /** Absolute JSONL path; this is the only stable handle for duplicate ids. */
  path: Schema.String.pipe(Schema.nonEmptyString()),
  /** Working directory captured in the pi session header. */
  cwd: Schema.String,
})
export type PiCliSessionRef = typeof PiCliSessionRef.Type

export const SessionRef = Schema.Union(HarnessStoredSessionRef, PiCliSessionRef)
export type SessionRef = typeof SessionRef.Type

export const sessionRefKey = (ref: SessionRef): string => {
  switch (ref._tag) {
    case 'HarnessStoredSessionRef':
      return `harness:${ref.id}`
    case 'PiCliSessionRef':
      return `pi-cli:${ref.path}`
  }
}

// =============================================================================
// Pi session listing/loading
// =============================================================================

export const PiSessionListScope = Schema.Literal('current', 'all', 'current-plus-all')
export type PiSessionListScope = typeof PiSessionListScope.Type

export const PiSessionListOptions = Schema.Struct({
  scope: Schema.optional(PiSessionListScope),
  cwd: Schema.optional(Schema.String),
  /** Optional explicit pi session dir, matching the CLI --session-dir concept. */
  sessionDir: Schema.optional(Schema.String),
  /** Optional max rows after sorting/project bias. */
  limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
})
export type PiSessionListOptions = typeof PiSessionListOptions.Type

export const PiSessionListItem = Schema.TaggedStruct('PiSessionListItem', {
  ref: PiCliSessionRef,
  title: Schema.String,
  name: Schema.optional(Schema.String),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  messageCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  preview: Schema.String,
  /** Search text. Server may omit this for fast-list mode. */
  allMessagesText: Schema.optional(Schema.String),
  parentSessionPath: Schema.optional(Schema.String),
  /** True when ref.cwd === requested cwd. Used for CLI-like biasing. */
  localProject: Schema.Boolean,
  /** Lower sorts first when updatedAt ties; current project beats global. */
  sourceRank: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
export type PiSessionListItem = typeof PiSessionListItem.Type

export const PiSessionListDiagnostics = Schema.Struct({
  dirsScanned: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  filesScanned: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  duplicateDirsSkipped: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  duplicatePathsSkipped: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  bytesPerFile: Schema.Number.pipe(Schema.int(), Schema.positive()),
  discoverMs: Schema.Number,
  parseMs: Schema.Number,
  sortMs: Schema.Number,
  cacheEnabled: Schema.optional(Schema.Boolean),
  cachePath: Schema.optional(Schema.String),
  cacheReadMs: Schema.optional(Schema.Number),
  cacheWriteMs: Schema.optional(Schema.Number),
  cacheHits: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  cacheMisses: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  cacheStale: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  cacheEntriesLoaded: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  cacheEntriesWritten: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  cacheCorrupt: Schema.optional(Schema.Boolean),
  /** Effect Cache stats for computational lookup dedupe. */
  effectCacheHits: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  effectCacheMisses: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  effectCacheSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  /** Persistent JSON warm-start hits. */
  diskCacheHits: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  cacheInvalidSessions: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  cacheLookupErrors: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
})
export type PiSessionListDiagnostics = typeof PiSessionListDiagnostics.Type

export const PiSessionMetadataCacheEntry = Schema.TaggedStruct('PiSessionMetadataCacheEntry', {
  path: Schema.String.pipe(Schema.nonEmptyString()),
  size: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  mtimeMs: Schema.Number,
  item: PiSessionListItem,
})
export type PiSessionMetadataCacheEntry = typeof PiSessionMetadataCacheEntry.Type

export const PiSessionMetadataCacheFile = Schema.TaggedStruct('PiSessionMetadataCacheFile', {
  schemaVersion: Schema.Literal(1),
  generatedAt: Schema.Number,
  entries: Schema.Array(PiSessionMetadataCacheEntry),
})
export type PiSessionMetadataCacheFile = typeof PiSessionMetadataCacheFile.Type

export const PiSessionListPayload = Schema.Struct({
  sessions: Schema.Array(PiSessionListItem),
  loadedAt: Schema.Number,
  elapsedMs: Schema.Number,
  scope: PiSessionListScope,
  diagnostics: Schema.optional(PiSessionListDiagnostics),
})
export type PiSessionListPayload = typeof PiSessionListPayload.Type

// =============================================================================
// Summaries, blessings, and groups
// =============================================================================

export const SessionSummary = Schema.TaggedStruct('SessionSummary', {
  text: Schema.String,
  generatedAt: Schema.Number,
  provider: Schema.String,
  modelId: Schema.String,
  /** Input fingerprint used to avoid regenerating stale summaries. */
  sourceHash: Schema.optional(Schema.String),
})
export type SessionSummary = typeof SessionSummary.Type

export const SessionAnnotation = Schema.TaggedStruct('SessionAnnotation', {
  ref: SessionRef,
  /** User-facing name override. */
  name: Schema.optional(Schema.String),
  /** User-written description / why this session matters. */
  description: Schema.optional(Schema.String),
  /** Cheap-model summary, generated lazily. */
  summary: Schema.optional(SessionSummary),
  blessed: Schema.Boolean,
  tags: Schema.Array(Schema.String),
  updatedAt: Schema.Number,
})
export type SessionAnnotation = typeof SessionAnnotation.Type

export const MultiSessionMember = Schema.TaggedStruct('MultiSessionMember', {
  ref: SessionRef,
  order: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  addedAt: Schema.Number,
  role: Schema.optional(Schema.String),
  blessed: Schema.Boolean,
})
export type MultiSessionMember = typeof MultiSessionMember.Type

export const MultiSessionGroup = Schema.TaggedStruct('MultiSessionGroup', {
  id: Schema.String.pipe(Schema.nonEmptyString()),
  name: Schema.String,
  description: Schema.optional(Schema.String),
  members: Schema.Array(MultiSessionMember),
  tags: Schema.Array(Schema.String),
  summary: Schema.optional(SessionSummary),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})
export type MultiSessionGroup = typeof MultiSessionGroup.Type

export const AsyncSessionSlotStatus = Schema.Literal('empty', 'loading', 'ready', 'streaming', 'error')
export type AsyncSessionSlotStatus = typeof AsyncSessionSlotStatus.Type

export const AsyncSessionSlot = Schema.TaggedStruct('AsyncSessionSlot', {
  id: Schema.String.pipe(Schema.nonEmptyString()),
  ref: Schema.optional(SessionRef),
  status: AsyncSessionSlotStatus,
  panelId: Schema.optional(Schema.String),
  lastActivatedAt: Schema.optional(Schema.Number),
  error: Schema.optional(Schema.String),
})
export type AsyncSessionSlot = typeof AsyncSessionSlot.Type

export const MultiSessionLedgerSnapshot = Schema.TaggedStruct('MultiSessionLedgerSnapshot', {
  annotations: Schema.Array(SessionAnnotation),
  groups: Schema.Array(MultiSessionGroup),
  activeGroupId: Schema.NullOr(Schema.String),
  slots: Schema.Array(AsyncSessionSlot),
  updatedAt: Schema.Number,
})
export type MultiSessionLedgerSnapshot = typeof MultiSessionLedgerSnapshot.Type
