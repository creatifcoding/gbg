/**
 * Agent Task Atoms — Streamable reactive state for the log view.
 *
 * Architecture follows Atom-as-State pattern (AGENTS.md mandate):
 * - Atom.make() as primary state — no Effect.Ref inside services
 * - Service methods mutate atoms directly via Atom.set
 * - React subscribes directly via useAtomValue / useAtom
 *
 * Atom inventory:
 * - logRuntimeAtom: Atom.runtime for AgentTaskService layer
 * - logBufferFamily: Atom.family<taskId, AssembledLogEntry[]> — per-task buffer
 * - logStreamFamily: Atom.fn<taskId> — triggers subscription + populates buffer
 * - filterAtom: Writable filter state (severity, search, source, timeRange, regex)
 * - tailModeFamily: Atom.family<taskId, 'tail' | 'inspect'> — per-task scroll mode
 * - logCountFamily: derived atom — per-task entry count
 *
 * @module agent-task/atoms
 */

import { Atom } from '@effect-atom/atom'
import { Effect, Stream, Chunk, DateTime, pipe } from 'effect'
import type { LogLevel } from '../schemas/log-level'
import type { AssembledLogEntry } from '../services/CodecService'
import { AgentTaskService } from '../services/AgentTaskService'
import { AgentTaskServiceMock } from '../services/layers'

// ---------------------------------------------------------------------------
// Runtime atom — provides AgentTaskService to all derived atoms
// ---------------------------------------------------------------------------

/**
 * Runtime atom backed by AgentTaskServiceMock (dev/testbed).
 *
 * For production, create a separate runtime with AgentTaskServiceNats:
 * ```typescript
 * export const logRuntimeAtomProd = Atom.runtime(AgentTaskServiceNats)
 * ```
 */
export const logRuntimeAtom = Atom.runtime(AgentTaskServiceMock)

// ---------------------------------------------------------------------------
// Per-task log buffer — the primary state
// ---------------------------------------------------------------------------

/**
 * Per-task accumulated log entries.
 * Writable: stream subscription appends entries via Atom.set.
 */
export const logBufferFamily = Atom.family(
  (_taskId: string) => Atom.make<ReadonlyArray<AssembledLogEntry>>([]),
)

// ---------------------------------------------------------------------------
// Per-task stream trigger — Atom.fn that subscribes + populates buffer
// ---------------------------------------------------------------------------

/**
 * Trigger log streaming for a task.
 *
 * When written to with a taskId, this:
 * 1. Opens a scoped subscription via AgentTaskService.subscribeLogs
 * 2. Pipes each AssembledLogEntry into the task's logBufferFamily
 * 3. Returns the Result for status tracking
 *
 * Write: set(logStreamTrigger, 'task-001')
 * Read: Result.Result<true> (success when stream completes)
 *
 * Pattern: runtimeAtom.fn<Arg>()(fn) — double-call generic
 */
export const logStreamTrigger = logRuntimeAtom.fn<string>()(
  (taskId, ctx) =>
    Effect.gen(function* () {
      const svc = yield* AgentTaskService
      const bufferAtom = logBufferFamily(taskId)

      // Subscribe to assembled log stream
      const stream = yield* svc.subscribeLogs(taskId)

      // Consume stream, appending each entry to the buffer atom
      yield* stream.pipe(
        Stream.runForEach((entry) =>
          Effect.sync(() => {
            const current = ctx.get(bufferAtom)
            // Use mergeIntoBuffer for dedup + sort
            const merged = svc.mergeIntoBuffer(current, [entry])
            ctx.set(bufferAtom, merged)
          }),
        ),
      )

      return true as const
    }),
)

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

/** Log view filter configuration. */
export interface LogFilterState {
  /** Minimum severity threshold */
  readonly minLevel: LogLevel
  /** Substring search in message content */
  readonly search: string
  /** Substring match on source field */
  readonly source: string
  /** Optional time range bounds (epoch ms) */
  readonly timeRange: {
    readonly start: number | null
    readonly end: number | null
  }
  /** Optional regex pattern for message matching */
  readonly regex: string
}

/** Default filter state — show everything. */
export const DEFAULT_FILTER: LogFilterState = {
  minLevel: 'DEBUG',
  search: '',
  source: '',
  timeRange: { start: null, end: null },
  regex: '',
}

/**
 * Global filter state atom.
 *
 * Shared across all task log views. Components read and write directly.
 * Filtering is applied at the view layer (not transport/service) for instant
 * responsiveness — the full buffer is always available.
 */
export const logFilterAtom = Atom.make<LogFilterState>(DEFAULT_FILTER)

// ---------------------------------------------------------------------------
// Tail mode — per-task scroll behavior
// ---------------------------------------------------------------------------

/** Log view scroll mode. */
export type TailMode = 'tail' | 'inspect'

/**
 * Per-task tail mode.
 * - 'tail': auto-scroll to latest entries (follow mode)
 * - 'inspect': user has scrolled up, don't auto-scroll
 */
export const tailModeFamily = Atom.family(
  (_taskId: string) => Atom.make<TailMode>('tail'),
)

// ---------------------------------------------------------------------------
// Derived: filtered buffer
// ---------------------------------------------------------------------------

/**
 * Filtered log buffer for a task.
 *
 * Derives from logBufferFamily + logFilterAtom.
 * Re-computes when either changes.
 */
export const filteredLogBufferFamily = Atom.family(
  (taskId: string) =>
    Atom.readable((get) => {
      const buffer = get(logBufferFamily(taskId))
      const filter = get(logFilterAtom)

      return applyFilters(buffer, filter)
    }),
)

/** Apply all active filters to a buffer. */
const applyFilters = (
  buffer: ReadonlyArray<AssembledLogEntry>,
  filter: LogFilterState,
): ReadonlyArray<AssembledLogEntry> => {
  let result = buffer

  // Severity filter
  if (filter.minLevel !== 'DEBUG') {
    const SEVERITY: Record<string, number> = {
      DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4,
    }
    const threshold = SEVERITY[filter.minLevel] ?? 0
    result = result.filter((a) => a.severityOrd >= threshold)
  }

  // Search filter (message substring)
  if (filter.search.length > 0) {
    const lower = filter.search.toLowerCase()
    result = result.filter((a) =>
      a.entry.message.toLowerCase().includes(lower),
    )
  }

  // Source filter
  if (filter.source.length > 0) {
    const lower = filter.source.toLowerCase()
    result = result.filter((a) =>
      a.entry.source.toLowerCase().includes(lower),
    )
  }

  // Time range filter
  if (filter.timeRange.start !== null || filter.timeRange.end !== null) {
    result = result.filter((a) => {
      const ts = DateTime.toEpochMillis(a.entry.timestamp)
      if (filter.timeRange.start !== null && ts < filter.timeRange.start) return false
      if (filter.timeRange.end !== null && ts > filter.timeRange.end) return false
      return true
    })
  }

  // Regex filter
  if (filter.regex.length > 0) {
    try {
      const re = new RegExp(filter.regex, 'i')
      result = result.filter((a) => re.test(a.entry.message))
    } catch {
      // Invalid regex — silently skip
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Derived: counts
// ---------------------------------------------------------------------------

/**
 * Entry count for a task's filtered buffer.
 * Useful for badges and metrics band.
 */
export const logCountFamily = Atom.family(
  (taskId: string) =>
    Atom.readable((get) => get(filteredLogBufferFamily(taskId)).length),
)

/**
 * Entry count for a task's unfiltered buffer.
 */
export const logTotalCountFamily = Atom.family(
  (taskId: string) =>
    Atom.readable((get) => get(logBufferFamily(taskId)).length),
)

// ---------------------------------------------------------------------------
// Re-export view state atoms
// ---------------------------------------------------------------------------

export {
  taskViewModeFamily,
  viewOrder,
  getSlideDirection,
  type TaskViewMode,
} from './view-state'
