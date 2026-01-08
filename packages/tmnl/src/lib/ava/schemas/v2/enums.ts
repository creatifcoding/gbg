/**
 * AVA v2 Enumeration Schemas
 *
 * Effect Schema definitions for proto enums.
 * Uses Schema.Literal for type-safe union types.
 *
 * @pattern Effect Schema Literal unions
 * @see src-ava/proto/ava/execution/v1/execution.proto
 * @see src-ava/proto/ava/artifacts/v1/artifacts.proto
 * @see src-ava/proto/ava/events/v1/events.proto
 * @module
 */

import { Schema } from 'effect'

// ============================================================================
// Channel Enums
// ============================================================================

/**
 * ChannelRole - Semantic role of a data channel
 * Proto: ava.execution.v1.ChannelRole
 */
export const ChannelRole = Schema.Literal(
  'CHANNEL_ROLE_UNSPECIFIED',
  'CHANNEL_ROLE_STATE',
  'CHANNEL_ROLE_EVENT',
  'CHANNEL_ROLE_METRIC',
  'CHANNEL_ROLE_COMMAND',
  'CHANNEL_ROLE_LOG'
).pipe(
  Schema.annotations({
    title: 'ChannelRole',
    description: 'Semantic role of a data channel within a view',
  })
)
export type ChannelRole = typeof ChannelRole.Type

/** ChannelRole with human-friendly aliases */
export const ChannelRoleShort = Schema.Literal(
  'State',
  'Event',
  'Metric',
  'Command',
  'Log'
).pipe(
  Schema.annotations({
    title: 'ChannelRoleShort',
    description: 'Short-form channel role names',
  })
)
export type ChannelRoleShort = typeof ChannelRoleShort.Type

// ----------------------------------------------------------------------------

/**
 * ChannelDisplayRole - UI/display role of a channel
 * Proto: ava.execution.v1.ChannelDisplayRole
 */
export const ChannelDisplayRole = Schema.Literal(
  'CHANNEL_DISPLAY_ROLE_UNSPECIFIED',
  'DISPLAY_PRIMARY',
  'DISPLAY_SECONDARY',
  'DISPLAY_FILTER',
  'DISPLAY_SORT',
  'DISPLAY_SELECTION',
  'DISPLAY_AGGREGATE',
  'DISPLAY_COMPUTED',
  'DISPLAY_SCHEMA',
  'DISPLAY_STATS'
).pipe(
  Schema.annotations({
    title: 'ChannelDisplayRole',
    description: 'UI/display role of a channel in a view',
  })
)
export type ChannelDisplayRole = typeof ChannelDisplayRole.Type

// ============================================================================
// Materialization Enums
// ============================================================================

/**
 * MaterializationTier - How channel data is computed/stored
 * Proto: ava.execution.v1.MaterializationTier
 */
export const MaterializationTier = Schema.Literal(
  'MATERIALIZATION_TIER_UNSPECIFIED',
  'MATERIALIZATION_TIER_ON_DEMAND',
  'MATERIALIZATION_TIER_CACHED',
  'MATERIALIZATION_TIER_MATERIALIZED'
).pipe(
  Schema.annotations({
    title: 'MaterializationTier',
    description: 'How channel data is computed and stored',
  })
)
export type MaterializationTier = typeof MaterializationTier.Type

/** Human-friendly materialization tier names */
export const MaterializationTierShort = Schema.Literal(
  'OnDemand',
  'Cached',
  'Continuous'
).pipe(
  Schema.annotations({
    title: 'MaterializationTierShort',
    description: 'Short-form materialization tier names',
  })
)
export type MaterializationTierShort = typeof MaterializationTierShort.Type

// ============================================================================
// Artifact State Enums
// ============================================================================

/**
 * ArtifactState - Lifecycle state of a view artifact
 * Proto: ava.artifacts.v1.ArtifactState
 */
export const ArtifactState = Schema.Literal(
  'ARTIFACT_STATE_UNSPECIFIED',
  'COMPILING',
  'ACTIVE',
  'SUSPENDED',
  'UNMOUNTING',
  'ERROR',
  'SUPERSEDED'
).pipe(
  Schema.annotations({
    title: 'ArtifactState',
    description: 'Lifecycle state of a view artifact',
  })
)
export type ArtifactState = typeof ArtifactState.Type

// ----------------------------------------------------------------------------

/**
 * DeactivationReason - Why a channel was deactivated
 * Proto: ava.artifacts.v1.DeactivationReason
 */
export const DeactivationReason = Schema.Literal(
  'DEACTIVATION_REASON_UNSPECIFIED',
  'SOURCE_DISCONNECTED',
  'QUERY_FAILED',
  'TIMEOUT',
  'CLIENT_REQUEST',
  'REPLACED'
).pipe(
  Schema.annotations({
    title: 'DeactivationReason',
    description: 'Reason for channel deactivation',
  })
)
export type DeactivationReason = typeof DeactivationReason.Type

// ----------------------------------------------------------------------------

/**
 * ReplacementReason - Why an artifact was replaced
 * Proto: ava.artifacts.v1.ReplacementReason
 */
export const ReplacementReason = Schema.Literal(
  'REPLACEMENT_REASON_UNSPECIFIED',
  'SPEC_CHANGED',
  'INVALIDATED',
  'UPGRADED',
  'RECOMPILED',
  'MIGRATED'
).pipe(
  Schema.annotations({
    title: 'ReplacementReason',
    description: 'Reason for artifact replacement',
  })
)
export type ReplacementReason = typeof ReplacementReason.Type

// ============================================================================
// Event Enums
// ============================================================================

/**
 * UnmountReason - Why a view was unmounted
 * Proto: ava.events.v1.UnmountReason
 */
export const UnmountReason = Schema.Literal(
  'UNMOUNT_REASON_UNSPECIFIED',
  'UNMOUNT_CLIENT_REQUEST',
  'UNMOUNT_REPLACED',
  'UNMOUNT_ERROR',
  'UNMOUNT_RESOURCE_LIMIT',
  'UNMOUNT_ASSEMBLAGE_MISMATCH',
  'UNMOUNT_SHUTDOWN',
  'UNMOUNT_TIMEOUT',
  'UNMOUNT_EVICTED'
).pipe(
  Schema.annotations({
    title: 'UnmountReason',
    description: 'Reason for view unmounting',
  })
)
export type UnmountReason = typeof UnmountReason.Type

// ----------------------------------------------------------------------------

/**
 * SuspendReason - Why a view was suspended
 * Proto: ava.events.v1.SuspendReason
 */
export const SuspendReason = Schema.Literal(
  'SUSPEND_REASON_UNSPECIFIED',
  'SUSPEND_IDLE',
  'SUSPEND_RESOURCE_PRESSURE',
  'SUSPEND_SOURCE_UNAVAILABLE',
  'SUSPEND_CLIENT_REQUEST',
  'SUSPEND_RATE_LIMITED'
).pipe(
  Schema.annotations({
    title: 'SuspendReason',
    description: 'Reason for view suspension',
  })
)
export type SuspendReason = typeof SuspendReason.Type

// ----------------------------------------------------------------------------

/**
 * InvalidationScope - What was invalidated
 * Proto: ava.events.v1.InvalidationScope
 */
export const InvalidationScope = Schema.Literal(
  'INVALIDATION_SCOPE_UNSPECIFIED',
  'FULL',
  'CHANNELS',
  'METADATA'
).pipe(
  Schema.annotations({
    title: 'InvalidationScope',
    description: 'Scope of invalidation',
  })
)
export type InvalidationScope = typeof InvalidationScope.Type

// ----------------------------------------------------------------------------

/**
 * RequestPriority - Urgency of a view request
 * Proto: ava.events.v1.RequestPriority
 */
export const RequestPriority = Schema.Literal(
  'REQUEST_PRIORITY_UNSPECIFIED',
  'REQUEST_PRIORITY_LOW',
  'REQUEST_PRIORITY_NORMAL',
  'REQUEST_PRIORITY_HIGH',
  'REQUEST_PRIORITY_IMMEDIATE'
).pipe(
  Schema.annotations({
    title: 'RequestPriority',
    description: 'Priority level for view requests',
  })
)
export type RequestPriority = typeof RequestPriority.Type

// ============================================================================
// Pipeline Enums
// ============================================================================

/**
 * JoinType - Type of join operation
 * Proto: ava.execution.v1.JoinType
 */
export const JoinType = Schema.Literal(
  'JOIN_TYPE_UNSPECIFIED',
  'JOIN_TYPE_INNER',
  'JOIN_TYPE_LEFT',
  'JOIN_TYPE_RIGHT',
  'JOIN_TYPE_FULL',
  'JOIN_TYPE_CROSS'
).pipe(
  Schema.annotations({
    title: 'JoinType',
    description: 'Type of join operation in pipeline',
  })
)
export type JoinType = typeof JoinType.Type

// ----------------------------------------------------------------------------

/**
 * OutputFormat - Data output format
 * Proto: ava.execution.v1.OutputFormat
 */
export const OutputFormat = Schema.Literal(
  'OUTPUT_FORMAT_UNSPECIFIED',
  'OUTPUT_FORMAT_JSON',
  'OUTPUT_FORMAT_ARROW_IPC'
).pipe(
  Schema.annotations({
    title: 'OutputFormat',
    description: 'Format for channel data output',
  })
)
export type OutputFormat = typeof OutputFormat.Type

// ----------------------------------------------------------------------------

/**
 * DataFormat - Preferred data format for hydration
 * Proto: ava.execution.v1.DataFormat
 */
export const DataFormat = Schema.Literal(
  'DATA_FORMAT_UNSPECIFIED',
  'ARROW_IPC',
  'JSON',
  'JSON_LINES'
).pipe(
  Schema.annotations({
    title: 'DataFormat',
    description: 'Preferred format for channel data',
  })
)
export type DataFormat = typeof DataFormat.Type

// ----------------------------------------------------------------------------

/**
 * Codec - Compression codec for Arrow IPC
 * Proto: ava.execution.v1.Codec
 */
export const Codec = Schema.Literal(
  'CODEC_UNSPECIFIED',
  'NONE',
  'LZ4',
  'ZSTD',
  'SNAPPY'
).pipe(
  Schema.annotations({
    title: 'Codec',
    description: 'Compression codec for Arrow IPC data',
  })
)
export type Codec = typeof Codec.Type

// ============================================================================
// Stream Enums
// ============================================================================

/**
 * StreamProtocol - Streaming protocol type
 * Proto: ava.execution.v1.StreamProtocol
 */
export const StreamProtocol = Schema.Literal(
  'STREAM_PROTOCOL_UNSPECIFIED',
  'GRPC_SERVER_STREAM',
  'GRPC_BIDI_STREAM',
  'WEBSOCKET',
  'SSE'
).pipe(
  Schema.annotations({
    title: 'StreamProtocol',
    description: 'Protocol for streaming data',
  })
)
export type StreamProtocol = typeof StreamProtocol.Type

// ----------------------------------------------------------------------------

/**
 * OverflowStrategy - Backpressure overflow handling
 * Proto: ava.execution.v1.OverflowStrategy
 */
export const OverflowStrategy = Schema.Literal(
  'OVERFLOW_STRATEGY_UNSPECIFIED',
  'DROP_OLDEST',
  'DROP_NEWEST',
  'BLOCK',
  'ERROR'
).pipe(
  Schema.annotations({
    title: 'OverflowStrategy',
    description: 'Strategy for handling buffer overflow',
  })
)
export type OverflowStrategy = typeof OverflowStrategy.Type

// ============================================================================
// Fiber Enums
// ============================================================================

/**
 * FiberPriority - Fiber scheduling priority
 * Proto: ava.events.v1.FiberPriority
 */
export const FiberPriority = Schema.Literal(
  'FIBER_PRIORITY_UNSPECIFIED',
  'FIBER_PRIORITY_BACKGROUND',
  'FIBER_PRIORITY_NORMAL',
  'FIBER_PRIORITY_HIGH',
  'FIBER_PRIORITY_CRITICAL'
).pipe(
  Schema.annotations({
    title: 'FiberPriority',
    description: 'Priority level for reconciler fibers',
  })
)
export type FiberPriority = typeof FiberPriority.Type

// ----------------------------------------------------------------------------

/**
 * YieldReason - Why a fiber yielded
 * Proto: ava.events.v1.YieldReason
 */
export const YieldReason = Schema.Literal(
  'YIELD_REASON_UNSPECIFIED',
  'AWAIT_IO',
  'AWAIT_DEPENDENCY',
  'FAIR_SHARE',
  'BACKPRESSURE'
).pipe(
  Schema.annotations({
    title: 'YieldReason',
    description: 'Reason for fiber yield',
  })
)
export type YieldReason = typeof YieldReason.Type

// ----------------------------------------------------------------------------

/**
 * CancelReason - Why a fiber was cancelled
 * Proto: ava.events.v1.CancelReason
 */
export const CancelReason = Schema.Literal(
  'CANCEL_REASON_UNSPECIFIED',
  'CANCEL_CLIENT_REQUEST',
  'CANCEL_SUPERSEDED',
  'CANCEL_TIMEOUT',
  'CANCEL_SHUTDOWN',
  'CANCEL_PARENT_CANCELLED'
).pipe(
  Schema.annotations({
    title: 'CancelReason',
    description: 'Reason for fiber cancellation',
  })
)
export type CancelReason = typeof CancelReason.Type
