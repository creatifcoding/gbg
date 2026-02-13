/**
 * AgentTaskService — Top-level service composing LogService + future siblings.
 *
 * This is the primary entry point for agent task operations.
 * It composes domain services as sibling deps:
 *
 *   AgentTaskService → { LogService, ... future: MetricsService, LifecycleService }
 *     LogService → { CodecService, TransportService }
 *
 * The service provides a unified API for:
 * - Log streaming (delegates to LogService)
 * - Task lifecycle operations (future)
 * - Task metrics (future)
 *
 * @module agent-task/services/AgentTaskService
 */

import {
  Context,
  Effect,
  Layer,
  Stream,
  Scope,
} from 'effect'
import { LogService, type LogServiceShape, type LogStreamOptions } from './LogService'
import { type AssembledLogEntry } from './CodecService'
import { type AgentTaskLogEntry } from '../schemas/log-entry'
import { type TransportSubscribeError, type TransportPublishError } from './TransportService'

// ---------------------------------------------------------------------------
// Service shape
// ---------------------------------------------------------------------------

export interface AgentTaskServiceShape {
  // ─── Log Operations (delegated to LogService) ─────────────────────────────

  /** Subscribe to assembled log stream for a task. */
  readonly subscribeLogs: (
    taskId: string,
    opts?: LogStreamOptions,
  ) => Effect.Effect<
    Stream.Stream<AssembledLogEntry, TransportSubscribeError>,
    TransportSubscribeError,
    Scope.Scope
  >

  /** Assemble a batch of raw JSONL content into sorted, deduped entries. */
  readonly assembleBatch: (
    content: string,
  ) => Effect.Effect<ReadonlyArray<AssembledLogEntry>>

  /** Merge incoming entries into a buffer (dedup + sort). */
  readonly mergeIntoBuffer: (
    buffer: ReadonlyArray<AssembledLogEntry>,
    incoming: ReadonlyArray<AssembledLogEntry>,
  ) => ReadonlyArray<AssembledLogEntry>

  /** Publish a log entry for a task. */
  readonly publishLog: (
    taskId: string,
    entry: AgentTaskLogEntry,
  ) => Effect.Effect<void, TransportPublishError>

  // ─── Future: Lifecycle Operations ─────────────────────────────────────────
  // readonly startTask: (taskId: string) => Effect.Effect<void>
  // readonly stopTask: (taskId: string) => Effect.Effect<void>
  // readonly retryTask: (taskId: string) => Effect.Effect<void>

  // ─── Future: Metrics Operations ───────────────────────────────────────────
  // readonly getMetrics: (taskId: string) => Effect.Effect<TaskMetrics>
}

// ---------------------------------------------------------------------------
// Context.Tag
// ---------------------------------------------------------------------------

export class AgentTaskService extends Context.Tag('AgentTask/AgentTaskService')<
  AgentTaskService,
  AgentTaskServiceShape
>() {}

// ---------------------------------------------------------------------------
// Live implementation
// ---------------------------------------------------------------------------

const make = Effect.gen(function* () {
  const logService = yield* LogService

  const shape: AgentTaskServiceShape = {
    // Delegate all log operations to LogService
    subscribeLogs: logService.subscribe,
    assembleBatch: logService.assembleBatch,
    mergeIntoBuffer: logService.mergeIntoBuffer,
    publishLog: logService.publish,
  }

  return shape
})

// ---------------------------------------------------------------------------
// Layer — requires LogService in context
// ---------------------------------------------------------------------------

export const AgentTaskServiceLive = Layer.effect(AgentTaskService, make)
