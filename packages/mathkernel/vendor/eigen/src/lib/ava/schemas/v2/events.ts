/**
 * AVA v2 Event Schemas
 *
 * Effect Schema definitions for ReconcilerEvent and related types.
 * These represent view lifecycle transitions.
 *
 * @pattern Effect Schema Union with _tag discriminator
 * @see src-ava/proto/ava/events/v1/events.proto
 * @module
 */

import { Schema } from 'effect'
import {
  ViewId,
  AssetId,
  SessionId,
  FiberId,
  CorrelationId,
  EventSequenceFromString,
} from './identifiers'
import {
  UnmountReason,
  SuspendReason,
  InvalidationScope,
  RequestPriority,
  FiberPriority,
  YieldReason,
  CancelReason,
} from './enums'
import { ViewArtifact, ViewDelta, ViewProfileSpec, TimestampMs } from './artifacts'

// ============================================================================
// View Lifecycle Events
// ============================================================================

/**
 * ViewRequested - A client requested a view
 */
export const ViewRequested = Schema.Struct({
  _tag: Schema.Literal('ViewRequested'),
  viewId: ViewId,
  spec: ViewProfileSpec,
  assetId: Schema.optional(AssetId),
  sessionId: Schema.optional(SessionId),
  priority: RequestPriority,
}).pipe(
  Schema.annotations({
    title: 'ViewRequested',
    description: 'A client requested a view',
  })
)
export type ViewRequested = typeof ViewRequested.Type

/**
 * ViewCompiling - View compilation has started
 */
export const ViewCompiling = Schema.Struct({
  _tag: Schema.Literal('ViewCompiling'),
  viewId: ViewId,
  fiberId: FiberId,
  channelCount: Schema.Number,
}).pipe(
  Schema.annotations({
    title: 'ViewCompiling',
    description: 'View compilation has started',
  })
)
export type ViewCompiling = typeof ViewCompiling.Type

/**
 * ViewMounted - View was successfully compiled and mounted
 */
export const ViewMounted = Schema.Struct({
  _tag: Schema.Literal('ViewMounted'),
  viewId: ViewId,
  artifact: ViewArtifact,
  compileTimeMs: Schema.Number,
  fiberId: FiberId,
}).pipe(
  Schema.annotations({
    title: 'ViewMounted',
    description: 'View was successfully compiled and mounted',
  })
)
export type ViewMounted = typeof ViewMounted.Type

/**
 * ViewUpdated - View received a data update
 */
export const ViewUpdated = Schema.Struct({
  _tag: Schema.Literal('ViewUpdated'),
  viewId: ViewId,
  delta: ViewDelta,
  version: Schema.Number,
}).pipe(
  Schema.annotations({
    title: 'ViewUpdated',
    description: 'View received a data update',
  })
)
export type ViewUpdated = typeof ViewUpdated.Type

/**
 * ViewUnmounted - View was unmounted
 */
export const ViewUnmounted = Schema.Struct({
  _tag: Schema.Literal('ViewUnmounted'),
  viewId: ViewId,
  reason: UnmountReason,
  detail: Schema.optional(Schema.String),
  lifetimeMs: Schema.Number,
}).pipe(
  Schema.annotations({
    title: 'ViewUnmounted',
    description: 'View was unmounted',
  })
)
export type ViewUnmounted = typeof ViewUnmounted.Type

/**
 * ViewCompilationFailed - View failed to compile
 */
export const ViewCompilationFailed = Schema.Struct({
  _tag: Schema.Literal('ViewCompilationFailed'),
  viewId: ViewId,
  errorMessage: Schema.String,
  errorCode: Schema.optional(Schema.String),
  attempt: Schema.Number,
  willRetry: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'ViewCompilationFailed',
    description: 'View failed to compile',
  })
)
export type ViewCompilationFailed = typeof ViewCompilationFailed.Type

/**
 * ViewSuspended - View was suspended
 */
export const ViewSuspended = Schema.Struct({
  _tag: Schema.Literal('ViewSuspended'),
  viewId: ViewId,
  reason: SuspendReason,
  resumeHint: Schema.optional(Schema.Unknown),
}).pipe(
  Schema.annotations({
    title: 'ViewSuspended',
    description: 'View was suspended',
  })
)
export type ViewSuspended = typeof ViewSuspended.Type

/**
 * ViewResumed - View was resumed from suspension
 */
export const ViewResumed = Schema.Struct({
  _tag: Schema.Literal('ViewResumed'),
  viewId: ViewId,
  suspendedDurationMs: Schema.Number,
  requiredRecompile: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'ViewResumed',
    description: 'View was resumed from suspension',
  })
)
export type ViewResumed = typeof ViewResumed.Type

/**
 * ViewInvalidated - View was invalidated
 */
export const ViewInvalidated = Schema.Struct({
  _tag: Schema.Literal('ViewInvalidated'),
  viewId: ViewId,
  scope: InvalidationScope,
  reason: Schema.optional(Schema.String),
  triggeredBy: Schema.optional(SessionId),
}).pipe(
  Schema.annotations({
    title: 'ViewInvalidated',
    description: 'View was invalidated',
  })
)
export type ViewInvalidated = typeof ViewInvalidated.Type

/**
 * ViewSpecUpdated - View specification was updated
 */
export const ViewSpecUpdated = Schema.Struct({
  _tag: Schema.Literal('ViewSpecUpdated'),
  viewId: ViewId,
  oldSpec: ViewProfileSpec,
  newSpec: ViewProfileSpec,
  requiresRecompile: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'ViewSpecUpdated',
    description: 'View specification was updated',
  })
)
export type ViewSpecUpdated = typeof ViewSpecUpdated.Type

/**
 * ReconcilerEventPayload - Union of all reconciler event types
 */
export const ReconcilerEventPayload = Schema.Union(
  ViewRequested,
  ViewCompiling,
  ViewMounted,
  ViewUpdated,
  ViewUnmounted,
  ViewCompilationFailed,
  ViewSuspended,
  ViewResumed,
  ViewInvalidated,
  ViewSpecUpdated
).pipe(
  Schema.annotations({
    title: 'ReconcilerEventPayload',
    description: 'Union of all reconciler event types',
  })
)
export type ReconcilerEventPayload = typeof ReconcilerEventPayload.Type

// ============================================================================
// ReconcilerEvent (Envelope)
// ============================================================================

/**
 * ReconcilerEvent - High-level view lifecycle event
 * Proto: ava.events.v1.ReconcilerEvent
 */
export const ReconcilerEvent = Schema.Struct({
  /** Monotonic sequence number */
  sequence: EventSequenceFromString,
  /** When this event occurred (ms) */
  timestampMs: TimestampMs,
  /** Correlation ID for distributed tracing */
  correlationId: Schema.optional(CorrelationId),
  /** The actual event */
  event: ReconcilerEventPayload,
}).pipe(
  Schema.annotations({
    title: 'ReconcilerEvent',
    description: 'High-level view lifecycle event',
  })
)
export type ReconcilerEvent = typeof ReconcilerEvent.Type

// ============================================================================
// Fiber Action Events
// ============================================================================

/**
 * FiberSpawned - A new fiber was created
 */
export const FiberSpawned = Schema.Struct({
  _tag: Schema.Literal('FiberSpawned'),
  viewId: ViewId,
  priority: FiberPriority,
  parentFiberId: Schema.optional(FiberId),
}).pipe(
  Schema.annotations({
    title: 'FiberSpawned',
    description: 'A new fiber was created',
  })
)
export type FiberSpawned = typeof FiberSpawned.Type

/**
 * FiberYielded - Fiber yielded execution
 */
export const FiberYielded = Schema.Struct({
  _tag: Schema.Literal('FiberYielded'),
  reason: YieldReason,
  yieldDurationMs: Schema.optional(Schema.Number),
}).pipe(
  Schema.annotations({
    title: 'FiberYielded',
    description: 'Fiber yielded execution',
  })
)
export type FiberYielded = typeof FiberYielded.Type

/**
 * FiberResumed - Fiber resumed execution
 */
export const FiberResumed = Schema.Struct({
  _tag: Schema.Literal('FiberResumed'),
  suspendedDurationMs: Schema.Number,
}).pipe(
  Schema.annotations({
    title: 'FiberResumed',
    description: 'Fiber resumed execution',
  })
)
export type FiberResumed = typeof FiberResumed.Type

/**
 * FiberCompleted - Fiber completed successfully
 */
export const FiberCompleted = Schema.Struct({
  _tag: Schema.Literal('FiberCompleted'),
  durationMs: Schema.Number,
  workUnits: Schema.Number,
}).pipe(
  Schema.annotations({
    title: 'FiberCompleted',
    description: 'Fiber completed successfully',
  })
)
export type FiberCompleted = typeof FiberCompleted.Type

/**
 * FiberFailed - Fiber failed with an error
 */
export const FiberFailed = Schema.Struct({
  _tag: Schema.Literal('FiberFailed'),
  errorMessage: Schema.String,
  errorCode: Schema.optional(Schema.String),
  retryable: Schema.Boolean,
  retryAfterMs: Schema.optional(Schema.Number),
}).pipe(
  Schema.annotations({
    title: 'FiberFailed',
    description: 'Fiber failed with an error',
  })
)
export type FiberFailed = typeof FiberFailed.Type

/**
 * FiberCancelled - Fiber was cancelled
 */
export const FiberCancelled = Schema.Struct({
  _tag: Schema.Literal('FiberCancelled'),
  reason: CancelReason,
  detail: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'FiberCancelled',
    description: 'Fiber was cancelled',
  })
)
export type FiberCancelled = typeof FiberCancelled.Type

/**
 * FiberActionPayload - Union of all fiber action types
 */
export const FiberActionPayload = Schema.Union(
  FiberSpawned,
  FiberYielded,
  FiberResumed,
  FiberCompleted,
  FiberFailed,
  FiberCancelled
).pipe(
  Schema.annotations({
    title: 'FiberActionPayload',
    description: 'Union of all fiber action types',
  })
)
export type FiberActionPayload = typeof FiberActionPayload.Type

/**
 * FiberAction - Low-level reconciler fiber action
 * Proto: ava.events.v1.FiberAction
 */
export const FiberAction = Schema.Struct({
  /** Fiber identifier */
  fiberId: FiberId,
  /** Sequence within this fiber */
  sequence: Schema.Number,
  /** When this action occurred (ms) */
  timestampMs: TimestampMs,
  /** The action */
  action: FiberActionPayload,
}).pipe(
  Schema.annotations({
    title: 'FiberAction',
    description: 'Low-level reconciler fiber action',
  })
)
export type FiberAction = typeof FiberAction.Type

// ============================================================================
// Event Filter
// ============================================================================

/**
 * EventFilter - Filter for querying events
 * Proto: ava.events.v1.EventFilter
 */
export const EventFilter = Schema.Struct({
  /** Filter by event types */
  eventTypes: Schema.optional(Schema.Array(Schema.String)),
  /** Filter by view IDs */
  viewIds: Schema.optional(Schema.Array(ViewId)),
  /** Filter by time range (ms) */
  fromTimestampMs: Schema.optional(TimestampMs),
  toTimestampMs: Schema.optional(TimestampMs),
  /** Filter by sequence range */
  fromSequence: Schema.optional(EventSequenceFromString),
  toSequence: Schema.optional(EventSequenceFromString),
  /** Filter by correlation ID */
  correlationId: Schema.optional(CorrelationId),
}).pipe(
  Schema.annotations({
    title: 'EventFilter',
    description: 'Filter for querying events',
  })
)
export type EventFilter = typeof EventFilter.Type
