/**
 * LogService — Orchestrates CodecService + TransportService into a
 * consumption-ready log stream for the view layer.
 *
 * This is the primary service React components interact with:
 * - Subscribe to assembled log entries for a task
 * - Manage log buffer state (append, clear, filter)
 * - Publish log lines (for agent-side emission)
 *
 * DI tree:
 *   LogService → { CodecService, TransportService }
 *
 * @module agent-task/services/LogService
 */

import {
  Context,
  Effect,
  Layer,
  Stream,
  Scope,
  Ref,
  pipe,
} from 'effect'
import { CodecService, type AssembledLogEntry } from './CodecService'
import { TransportService, type TransportSubscribeError, type TransportPublishError } from './TransportService'
import { type AgentTaskLogEntry } from '../schemas/log-entry'
import { type LogLevel, meetsThreshold } from '../schemas/log-level'

// ---------------------------------------------------------------------------
// Log stream options
// ---------------------------------------------------------------------------

export interface LogStreamOptions {
  /** Minimum severity to include (default: 'DEBUG' — everything) */
  readonly minLevel?: LogLevel
  /** Filter by source string (substring match) */
  readonly sourceFilter?: string
  /** Filter by message content (substring match) */
  readonly messageFilter?: string
}

// ---------------------------------------------------------------------------
// Service shape
// ---------------------------------------------------------------------------

export interface LogServiceShape {
  /**
   * Subscribe to assembled log entries for a task.
   *
   * Returns a scoped Stream of AssembledLogEntry. The stream applies
   * optional filters (severity, source, message) before emission.
   *
   * @param taskId - Task to subscribe to
   * @param opts - Optional filters
   * @returns Scoped stream of assembled log entries
   */
  readonly subscribe: (
    taskId: string,
    opts?: LogStreamOptions,
  ) => Effect.Effect<
    Stream.Stream<AssembledLogEntry, TransportSubscribeError>,
    TransportSubscribeError,
    Scope.Scope
  >

  /**
   * Fetch and assemble a batch of log lines.
   *
   * Useful for initial hydration — subscribe to transport, collect N lines,
   * then assemble the batch. For ongoing streaming, use `subscribe`.
   *
   * @param taskId - Task to fetch logs for
   * @param content - Raw JSONL content (multi-line string)
   * @returns Assembled + deduped + sorted entries
   */
  readonly assembleBatch: (
    content: string,
  ) => Effect.Effect<ReadonlyArray<AssembledLogEntry>>

  /**
   * Merge incoming entries into an existing buffer.
   *
   * Delegates to CodecService.mergeMany for dedup + sort.
   */
  readonly mergeIntoBuffer: (
    buffer: ReadonlyArray<AssembledLogEntry>,
    incoming: ReadonlyArray<AssembledLogEntry>,
  ) => ReadonlyArray<AssembledLogEntry>

  /**
   * Publish a log entry for a task (agent-side emission).
   *
   * Serializes via CodecService, publishes via TransportService.
   */
  readonly publish: (
    taskId: string,
    entry: AgentTaskLogEntry,
  ) => Effect.Effect<void, TransportPublishError>
}

// ---------------------------------------------------------------------------
// Context.Tag
// ---------------------------------------------------------------------------

export class LogService extends Context.Tag('AgentTask/LogService')<
  LogService,
  LogServiceShape
>() {}

// ---------------------------------------------------------------------------
// Live implementation
// ---------------------------------------------------------------------------

const make = Effect.gen(function* () {
  const codec = yield* CodecService
  const transport = yield* TransportService

  const shape: LogServiceShape = {
    subscribe: (taskId, opts) =>
      Effect.gen(function* () {
        // Get raw JSONL stream from transport
        const rawStream = yield* transport.subscribe(taskId)

        // Assemble each line through CodecService
        const assembledStream = codec.assembleStream(rawStream)

        // Apply filters
        const filtered = pipe(
          assembledStream,
          // Severity filter
          opts?.minLevel
            ? Stream.filter((a) =>
                meetsThreshold(a.entry.level, opts.minLevel!),
              )
            : (s: typeof assembledStream) => s,
          // Source filter
          opts?.sourceFilter
            ? Stream.filter((a) =>
                a.entry.source
                  .toLowerCase()
                  .includes(opts.sourceFilter!.toLowerCase()),
              )
            : (s: Stream.Stream<AssembledLogEntry, TransportSubscribeError>) => s,
          // Message filter
          opts?.messageFilter
            ? Stream.filter((a) =>
                a.entry.message
                  .toLowerCase()
                  .includes(opts.messageFilter!.toLowerCase()),
              )
            : (s: Stream.Stream<AssembledLogEntry, TransportSubscribeError>) => s,
        )

        return filtered
      }),

    assembleBatch: (content) => codec.assembleLinesBatch(content),

    mergeIntoBuffer: (buffer, incoming) => codec.mergeMany(buffer, incoming),

    publish: (taskId, entry) => {
      const line = codec.serialize(entry)
      return transport.publish(taskId, line)
    },
  }

  return shape
})

// ---------------------------------------------------------------------------
// Layer — requires CodecService + TransportService
// ---------------------------------------------------------------------------

export const LogServiceLive = Layer.effect(LogService, make)
