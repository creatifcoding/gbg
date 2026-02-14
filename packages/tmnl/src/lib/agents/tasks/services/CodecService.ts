/**
 * CodecService — Effect.Service that marshals raw JSONL transport data
 * into consumption-ready log entries for the view layer.
 *
 * This is the assembly context. It:
 * 1. Parses raw JSONL lines via the codec primitives
 * 2. Deduplicates by entry ID (HashMap-based)
 * 3. Orders by timestamp (Array.sort + DateTime.Order)
 * 4. Enriches with display-ready metadata (relative time, severity class)
 * 5. Provides a Stream transformer: raw string lines → assembled entries
 *
 * Components consume AssembledLogEntry, not raw AgentTaskLogEntry.
 *
 * Concurrency:
 * - assembleLinesBatch uses Effect.forEach with { concurrency: "unbounded" }
 * - assembleStream uses Stream.mapEffect for per-element parsing
 *
 * @module agent-task/services/CodecService
 */

import {
  Context,
  Effect,
  Layer,
  Stream,
  DateTime,
  Order,
  Array as Arr,
  HashMap,
  pipe,
} from 'effect'
import { AgentTaskLogEntry } from '../schemas/log-entry'
import {
  type LogLevel,
  LOG_LEVEL_SEVERITY,
  logLevelDataAttr,
} from '../schemas/log-level'
import {
  parseLine,
  serializeLine,
  type JsonlParseError,
} from '../codec/jsonl-codec'

// ---------------------------------------------------------------------------
// AssembledLogEntry — the shape components consume
// ---------------------------------------------------------------------------

/** Display-ready log entry with computed presentation fields. */
export interface AssembledLogEntry {
  /** The validated domain object */
  readonly entry: AgentTaskLogEntry
  /** Numeric severity for sort/filter (0=DEBUG … 4=FATAL) */
  readonly severityOrd: number
  /** CSS data-attribute value for severity coloring */
  readonly levelAttr: string
  /** ISO string for display */
  readonly timestampDisplay: string
  /** Relative time string (e.g. "2s ago", "just now") — computed at assembly */
  readonly relativeTime: string
  /** Unique key for React list rendering */
  readonly key: string
}

// ---------------------------------------------------------------------------
// Ordering — uses DateTime.Order composed via Order.mapInput
// ---------------------------------------------------------------------------

/** Order AssembledLogEntry by timestamp ascending (oldest first). */
const byTimestamp: Order.Order<AssembledLogEntry> = Order.mapInput(
  DateTime.Order,
  (a: AssembledLogEntry) => a.entry.timestamp,
)

// ---------------------------------------------------------------------------
// Relative time formatter
// ---------------------------------------------------------------------------

const formatRelative = (
  entryTime: DateTime.Utc,
  now: DateTime.Utc,
): string => {
  const diffMs =
    DateTime.toEpochMillis(now) - DateTime.toEpochMillis(entryTime)
  if (diffMs < 1000) return 'just now'
  if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)}s ago`
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`
  return `${Math.floor(diffMs / 86_400_000)}d ago`
}

// ---------------------------------------------------------------------------
// Assembly — single entry
// ---------------------------------------------------------------------------

const assembleOne = (
  entry: AgentTaskLogEntry,
  now: DateTime.Utc,
): AssembledLogEntry => ({
  entry,
  severityOrd: LOG_LEVEL_SEVERITY[entry.level],
  levelAttr: logLevelDataAttr(entry.level),
  timestampDisplay: DateTime.formatIso(entry.timestamp),
  relativeTime: formatRelative(entry.timestamp, now),
  key: entry.id,
})

// ---------------------------------------------------------------------------
// Deduplication — HashMap by entry ID
// ---------------------------------------------------------------------------

const dedup = (
  entries: ReadonlyArray<AssembledLogEntry>,
): ReadonlyArray<AssembledLogEntry> => {
  const seen = HashMap.empty<string, true>()
  const result: AssembledLogEntry[] = []
  let map = seen
  for (const a of entries) {
    if (HashMap.has(map, a.key)) continue
    map = HashMap.set(map, a.key, true as const)
    result.push(a)
  }
  return result
}

// ---------------------------------------------------------------------------
// Service shape
// ---------------------------------------------------------------------------

export interface CodecServiceShape {
  /**
   * Parse a single JSONL line and assemble for display.
   * Fails with JsonlParseError on invalid input.
   */
  readonly assembleLine: (
    raw: string,
  ) => Effect.Effect<AssembledLogEntry, JsonlParseError>

  /**
   * Parse and assemble a batch of JSONL lines.
   * Concurrent parsing, deduplication by ID, ordered by timestamp.
   * Invalid lines are silently dropped.
   */
  readonly assembleLinesBatch: (
    content: string,
  ) => Effect.Effect<ReadonlyArray<AssembledLogEntry>>

  /**
   * Stream transformer: pipe raw JSONL string lines through this
   * to get assembled entries. Invalid lines are dropped.
   */
  readonly assembleStream: (
    raw: Stream.Stream<string>,
  ) => Stream.Stream<AssembledLogEntry>

  /**
   * Merge a new assembled entry into an existing ordered buffer.
   * Deduplicates by ID, maintains timestamp order via Array.sort.
   */
  readonly mergeInto: (
    buffer: ReadonlyArray<AssembledLogEntry>,
    incoming: AssembledLogEntry,
  ) => ReadonlyArray<AssembledLogEntry>

  /**
   * Merge multiple incoming entries into an existing buffer.
   * Dedup + sort in one pass.
   */
  readonly mergeMany: (
    buffer: ReadonlyArray<AssembledLogEntry>,
    incoming: ReadonlyArray<AssembledLogEntry>,
  ) => ReadonlyArray<AssembledLogEntry>

  /** Serialize an entry back to JSONL. */
  readonly serialize: (entry: AgentTaskLogEntry) => string
}

// ---------------------------------------------------------------------------
// Context.Tag
// ---------------------------------------------------------------------------

export class CodecService extends Context.Tag('AgentTask/CodecService')<
  CodecService,
  CodecServiceShape
>() {}

// ---------------------------------------------------------------------------
// Live implementation
// ---------------------------------------------------------------------------

const make: CodecServiceShape = {
  assembleLine: (raw) =>
    Effect.gen(function* () {
      const entry = yield* parseLine(raw)
      return assembleOne(entry, DateTime.unsafeNow())
    }),

  assembleLinesBatch: (content) =>
    Effect.gen(function* () {
      const lines = content.split('\n').filter((l) => l.trim().length > 0)
      const now = DateTime.unsafeNow()

      // Parse all lines concurrently, collecting Options
      const results = yield* Effect.forEach(
        lines,
        (line) => parseLine(line).pipe(Effect.option),
        { concurrency: 'unbounded' },
      )

      // Unwrap Some values, assemble, dedup, sort
      const assembled = pipe(
        Arr.getSomes(results),
        Arr.map((entry) => assembleOne(entry, now)),
      )

      return Arr.sort(dedup(assembled), byTimestamp)
    }),

  assembleStream: (raw) =>
    pipe(
      raw,
      Stream.mapEffect(
        (line) => parseLine(line).pipe(Effect.option),
        { concurrency: 4 },
      ),
      Stream.filterMap((opt) => opt),
      Stream.map((entry) => assembleOne(entry, DateTime.unsafeNow())),
    ),

  mergeInto: (buffer, incoming) => {
    // Check duplicate via HashMap lookup
    if (buffer.some((a) => a.key === incoming.key)) return buffer
    return Arr.sort([...buffer, incoming], byTimestamp)
  },

  mergeMany: (buffer, incoming) => {
    const combined = [...buffer, ...incoming]
    return Arr.sort(dedup(combined), byTimestamp)
  },

  serialize: serializeLine,
}

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

export const CodecServiceLive = Layer.succeed(CodecService, make)
