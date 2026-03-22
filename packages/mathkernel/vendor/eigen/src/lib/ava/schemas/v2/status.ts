/**
 * AVA v2 Status Event Schemas
 *
 * Effect Schema definitions for view lifecycle status events.
 * These are published to NATS `status.{view_id}` subjects.
 *
 * Matches Rust ava-domain/src/events.rs::ViewStatusEvent exactly.
 *
 * @pattern Effect Schema Struct
 * @see src-ava/ava-domain/src/events.rs
 * @module
 */

import { Schema } from 'effect'
import { ViewId } from './identifiers'

// ============================================================================
// View Lifecycle Status Enum
// ============================================================================

/**
 * ViewLifecycleStatus - Current lifecycle state of a view
 *
 * Matches Rust enum exactly (camelCase serialization).
 */
export const ViewLifecycleStatus = Schema.Literal(
  'pending',
  'compiling',
  'hydrating',
  'ready',
  'stale',
  'error',
  'suspended',
  'unmounting'
).pipe(
  Schema.annotations({
    title: 'ViewLifecycleStatus',
    description: 'Current lifecycle state of a view',
  })
)
export type ViewLifecycleStatus = typeof ViewLifecycleStatus.Type

// ============================================================================
// View Status Event
// ============================================================================

/**
 * ViewStatusEvent - NATS status update for a view
 *
 * Published to subject: `tmnl.ava.status.{view_id}`
 */
export const ViewStatusEvent = Schema.Struct({
  /** View identifier */
  viewId: ViewId,
  /** Current lifecycle status */
  status: ViewLifecycleStatus,
  /** Event timestamp (epoch ms) */
  timestampMs: Schema.Number,
  /** Optional progress percentage (0-100) */
  progressPct: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(0, 100))),
  /** Optional status message */
  message: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'ViewStatusEvent',
    description: 'NATS status update for a view',
  })
)
export type ViewStatusEvent = typeof ViewStatusEvent.Type

// ============================================================================
// Invalidation Reason (for rich invalidation events)
// ============================================================================

/**
 * InvalidationReasonSourceUpdate - Source data changed
 */
export const InvalidationReasonSourceUpdate = Schema.Struct({
  type: Schema.Literal('sourceUpdate'),
  content: Schema.Struct({
    sourceId: Schema.String,
  }),
})

/**
 * InvalidationReasonClientRequest - Client explicitly requested refresh
 */
export const InvalidationReasonClientRequest = Schema.Struct({
  type: Schema.Literal('clientRequest'),
})

/**
 * InvalidationReasonConfigChange - Configuration change requires recompilation
 */
export const InvalidationReasonConfigChange = Schema.Struct({
  type: Schema.Literal('configChange'),
})

/**
 * InvalidationReasonStaleData - Stale data detected (max age exceeded)
 */
export const InvalidationReasonStaleData = Schema.Struct({
  type: Schema.Literal('staleData'),
  content: Schema.Struct({
    ageMs: Schema.Number,
    maxAgeMs: Schema.Number,
  }),
})

/**
 * InvalidationReasonDependencyInvalidated - Dependency invalidated (cascading)
 */
export const InvalidationReasonDependencyInvalidated = Schema.Struct({
  type: Schema.Literal('dependencyInvalidated'),
  content: Schema.Struct({
    dependencyViewId: ViewId,
  }),
})

/**
 * InvalidationReasonManual - Manual/administrative invalidation
 */
export const InvalidationReasonManual = Schema.Struct({
  type: Schema.Literal('manual'),
  content: Schema.Struct({
    reason: Schema.String,
  }),
})

/**
 * InvalidationReason - Union of all invalidation reasons
 *
 * Uses Rust's adjacently tagged enum pattern: `tag = "type", content = "content"`
 */
export const InvalidationReason = Schema.Union(
  InvalidationReasonSourceUpdate,
  InvalidationReasonClientRequest,
  InvalidationReasonConfigChange,
  InvalidationReasonStaleData,
  InvalidationReasonDependencyInvalidated,
  InvalidationReasonManual
).pipe(
  Schema.annotations({
    title: 'InvalidationReason',
    description: 'Reason for view invalidation',
  })
)
export type InvalidationReason = typeof InvalidationReason.Type

// ============================================================================
// Invalidation Event (for audit/logging)
// ============================================================================

/**
 * InvalidationEvent - Full invalidation event with reason and metadata
 *
 * Published to subject: `tmnl.ava.invalidate.{view_id}`
 * This is the richer format used for audit logs (vs InvalidationRequest which is simpler).
 */
export const InvalidationEvent = Schema.Struct({
  /** View to invalidate */
  viewId: ViewId,
  /** Reason for invalidation */
  reason: InvalidationReason,
  /** Event timestamp (epoch ms) */
  timestampMs: Schema.Number,
  /** Optional correlation ID for request tracing */
  correlationId: Schema.optional(Schema.String),
  /** Client identifier (for auditing) */
  clientId: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'InvalidationEvent',
    description: 'Full invalidation event with reason and metadata',
  })
)
export type InvalidationEvent = typeof InvalidationEvent.Type

// ============================================================================
// Simple Invalidation Request (for client -> server commands)
// ============================================================================

/**
 * InvalidationRequest - Simple invalidation command from client
 *
 * This is the format expected by NatsSubscriber for invalidate.{view_id} subject.
 * Simpler than InvalidationEvent, used for client commands.
 */
export const InvalidationRequest = Schema.Struct({
  /** View to invalidate (canonical snake_case for runtime command payloads) */
  view_id: ViewId,
  /** Optional reason string */
  reason: Schema.optional(Schema.String),
  /** Force recomputation even if not stale */
  force: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'InvalidationRequest',
    description: 'Simple invalidation command from client',
  })
)
export type InvalidationRequest = typeof InvalidationRequest.Type

/**
 * SubscribeRequest - Client command to subscribe to a view
 */
export const SubscribeRequest = Schema.Struct({
  /** View to subscribe (canonical snake_case for runtime command payloads) */
  view_id: ViewId,
}).pipe(
  Schema.annotations({
    title: 'SubscribeRequest',
    description: 'Subscribe command payload from client',
  })
)
export type SubscribeRequest = typeof SubscribeRequest.Type

/**
 * UnsubscribeRequest - Client command to unsubscribe from a view
 */
export const UnsubscribeRequest = Schema.Struct({
  /** View to unsubscribe (canonical snake_case for runtime command payloads) */
  view_id: ViewId,
}).pipe(
  Schema.annotations({
    title: 'UnsubscribeRequest',
    description: 'Unsubscribe command payload from client',
  })
)
export type UnsubscribeRequest = typeof UnsubscribeRequest.Type
