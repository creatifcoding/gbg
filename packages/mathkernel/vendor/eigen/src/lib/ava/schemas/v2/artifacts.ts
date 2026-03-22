/**
 * AVA v2 Artifact Schemas
 *
 * Effect Schema definitions for ViewArtifact and ViewDelta.
 * These are the core runtime types streamed via NATS.
 *
 * @pattern Effect Schema Struct with optional fields
 * @see src-ava/proto/ava/artifacts/v1/artifacts.proto
 * @module
 */

import { Schema } from 'effect'
import {
  ViewId,
  ChannelId,
  AssetId,
} from './identifiers'
import {
  ArtifactState,
  ChannelRole,
  DeactivationReason,
  ReplacementReason,
} from './enums'
import { ChannelData } from './channel-data'

// ============================================================================
// Timestamps (ISO 8601 string in JSON, proto uses google.protobuf.Timestamp)
// ============================================================================

/**
 * Timestamp schema - ISO 8601 string decoded to Date
 */
export const Timestamp = Schema.Date.pipe(
  Schema.annotations({
    title: 'Timestamp',
    description: 'ISO 8601 timestamp',
  })
)
export type Timestamp = typeof Timestamp.Type

/**
 * TimestampMs - Unix timestamp in milliseconds
 * Used for compact JSON transport
 */
export const TimestampMs = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.annotations({
    title: 'TimestampMs',
    description: 'Unix timestamp in milliseconds',
  })
)
export type TimestampMs = typeof TimestampMs.Type

// ============================================================================
// Channel Spec (within ViewProfileSpec)
// ============================================================================

/**
 * ChannelSpec - Channel definition within a view spec
 * Proto: ava.artifacts.v1.ChannelSpec
 */
export const ChannelSpec = Schema.Struct({
  /** Channel identifier */
  channelId: ChannelId,
  /** Channel name */
  name: Schema.String,
  /** Semantic role */
  role: ChannelRole,
  /** Whether the channel is required */
  required: Schema.Boolean,
  /** Source query or expression */
  sourceExpr: Schema.optional(Schema.String),
  /** Expected schema (JSON Schema or Arrow schema) */
  schema: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'ChannelSpec',
    description: 'Channel definition within a view spec',
  })
)
export type ChannelSpec = typeof ChannelSpec.Type

// ============================================================================
// View Profile Spec
// ============================================================================

/**
 * ViewProfileSpec - View specification (blueprint)
 * Proto: ava.artifacts.v1.ViewProfileSpec
 */
export const ViewProfileSpec = Schema.Struct({
  /** Human-readable name */
  name: Schema.String,
  /** Optional description */
  description: Schema.optional(Schema.String),
  /** Domain this view belongs to */
  domain: Schema.String,
  /** Channel specifications */
  channels: Schema.Array(ChannelSpec),
  /** Default parameters */
  defaultParams: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  })),
  /** Tags for categorization */
  tags: Schema.optional(Schema.Array(Schema.String)),
}).pipe(
  Schema.annotations({
    title: 'ViewProfileSpec',
    description: 'View specification blueprint',
  })
)
export type ViewProfileSpec = typeof ViewProfileSpec.Type

// ============================================================================
// Channel Binding (Runtime State)
// ============================================================================

/**
 * ChannelBinding - Runtime state of a bound channel
 * Proto: ava.execution.v1.ChannelBinding
 *
 * Includes hydrated data payload (ChannelData) per I47 hydration model:
 * - None = not yet hydrated
 * - Pending = hydration in progress
 * - Inline/Rows/AssetRef/StreamHandle = hydrated with actual data
 * - Error = hydration failed
 */
export const ChannelBinding = Schema.Struct({
  /** Channel identifier */
  channelId: ChannelId,
  /** Channel name (human-readable) */
  name: Schema.String,
  /** Semantic role */
  role: ChannelRole,
  /** Whether channel is active (has data or is streaming) */
  active: Schema.Boolean,
  /** Current row count (for tabular channels) */
  rowCount: Schema.optional(Schema.Number),
  /** Last update timestamp (ms) */
  lastUpdatedMs: Schema.optional(TimestampMs),
  /**
   * Hydrated channel data payload
   * None = not yet hydrated, Some(Pending) = hydration in progress
   * @see ChannelData for all variants
   */
  data: Schema.optional(ChannelData),
  /** Data hash for change detection */
  dataHash: Schema.optional(Schema.String),
  /** Channel-specific metadata */
  metadata: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.String,
  })),
}).pipe(
  Schema.annotations({
    title: 'ChannelBinding',
    description: 'Runtime state of a bound channel with hydrated data',
  })
)
export type ChannelBinding = typeof ChannelBinding.Type

// ============================================================================
// Artifact Metrics
// ============================================================================

/**
 * ArtifactMetrics - Performance and usage metrics
 * Proto: ava.artifacts.v1.ArtifactMetrics
 */
export const ArtifactMetrics = Schema.Struct({
  /** Time to compile the artifact (ms) */
  compileTimeMs: Schema.Number,
  /** Time to initially hydrate all channels (ms) */
  initialHydrationMs: Schema.Number,
  /** Total data size across all channels (bytes) */
  totalDataBytes: Schema.Number,
  /** Number of active subscriptions */
  subscriptionCount: Schema.Number,
  /** Number of times this artifact was invalidated */
  invalidationCount: Schema.Number,
  /** Last access timestamp (ms) */
  lastAccessedMs: Schema.optional(TimestampMs),
}).pipe(
  Schema.annotations({
    title: 'ArtifactMetrics',
    description: 'Performance and usage metrics for an artifact',
  })
)
export type ArtifactMetrics = typeof ArtifactMetrics.Type

// ============================================================================
// View Artifact (Core Runtime Type)
// ============================================================================

/**
 * ViewArtifact - A fully compiled, runtime view instance
 * Proto: ava.artifacts.v1.ViewArtifact
 *
 * This is the primary type streamed to clients via NATS.
 */
export const ViewArtifact = Schema.Struct({
  /** Unique view identifier */
  viewId: ViewId,
  /** Optional: scoped to a specific asset */
  assetId: Schema.optional(AssetId),
  /** View profile specification */
  spec: ViewProfileSpec,
  /** All channel bindings with their current state */
  channelBindings: Schema.Array(ChannelBinding),
  /** When this artifact was created (ms) */
  createdAtMs: TimestampMs,
  /** Last modification timestamp (ms) */
  updatedAtMs: Schema.optional(TimestampMs),
  /** Logical version for optimistic concurrency */
  version: Schema.Number,
  /** Current lifecycle state */
  state: ArtifactState,
  /** Performance metrics */
  metrics: Schema.optional(ArtifactMetrics),
  /** Arbitrary metadata */
  metadata: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.String,
  })),
}).pipe(
  Schema.annotations({
    title: 'ViewArtifact',
    description: 'A fully compiled, runtime view instance',
  })
)
export type ViewArtifact = typeof ViewArtifact.Type

// ============================================================================
// View Delta Payloads
// ============================================================================

/**
 * RowRange - Range of rows affected by an update
 */
export const RowRange = Schema.Struct({
  /** Start index (inclusive) */
  start: Schema.Number,
  /** End index (exclusive) */
  end: Schema.Number,
}).pipe(
  Schema.annotations({
    title: 'RowRange',
    description: 'Range of rows affected by an update',
  })
)
export type RowRange = typeof RowRange.Type

/**
 * ChannelUpdated - A channel received new or updated data
 */
export const ChannelUpdated = Schema.Struct({
  _tag: Schema.Literal('ChannelUpdated'),
  /** Which channel was updated */
  channelId: ChannelId,
  /** New row count */
  rowCount: Schema.Number,
  /** Update timestamp (ms) */
  timestampMs: TimestampMs,
  /** Data hash for change detection */
  dataHash: Schema.optional(Schema.String),
  /** Whether this is a full replacement or incremental update */
  isFullRefresh: Schema.Boolean,
  /** For incremental: affected row ranges */
  affectedRows: Schema.optional(Schema.Array(RowRange)),
}).pipe(
  Schema.annotations({
    title: 'ChannelUpdated',
    description: 'Channel data update delta',
  })
)
export type ChannelUpdated = typeof ChannelUpdated.Type

/**
 * ChannelActivated - A channel became active
 */
export const ChannelActivated = Schema.Struct({
  _tag: Schema.Literal('ChannelActivated'),
  channelId: ChannelId,
  role: ChannelRole,
  schema: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'ChannelActivated',
    description: 'Channel activation delta',
  })
)
export type ChannelActivated = typeof ChannelActivated.Type

/**
 * ChannelDeactivated - A channel became inactive
 */
export const ChannelDeactivated = Schema.Struct({
  _tag: Schema.Literal('ChannelDeactivated'),
  channelId: ChannelId,
  reason: DeactivationReason,
}).pipe(
  Schema.annotations({
    title: 'ChannelDeactivated',
    description: 'Channel deactivation delta',
  })
)
export type ChannelDeactivated = typeof ChannelDeactivated.Type

/**
 * ChannelCleared - Channel data was explicitly cleared
 */
export const ChannelCleared = Schema.Struct({
  _tag: Schema.Literal('ChannelCleared'),
  channelId: ChannelId,
  reason: Schema.String,
}).pipe(
  Schema.annotations({
    title: 'ChannelCleared',
    description: 'Channel data cleared delta',
  })
)
export type ChannelCleared = typeof ChannelCleared.Type

/**
 * ArtifactReplaced - The entire artifact was replaced
 */
export const ArtifactReplaced = Schema.Struct({
  _tag: Schema.Literal('ArtifactReplaced'),
  /** The new artifact (full snapshot) */
  newArtifact: Schema.suspend(() => ViewArtifact),
  /** Previous version number */
  previousVersion: Schema.optional(Schema.Number),
  /** Reason for replacement */
  reason: ReplacementReason,
}).pipe(
  Schema.annotations({
    title: 'ArtifactReplaced',
    description: 'Artifact replacement delta',
  })
)
export type ArtifactReplaced = typeof ArtifactReplaced.Type

/**
 * StateChanged - Artifact state transition
 */
export const StateChanged = Schema.Struct({
  _tag: Schema.Literal('StateChanged'),
  previousState: ArtifactState,
  newState: ArtifactState,
  reason: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'StateChanged',
    description: 'Artifact state change delta',
  })
)
export type StateChanged = typeof StateChanged.Type

/**
 * MetadataUpdated - Artifact metadata was updated
 */
export const MetadataUpdated = Schema.Struct({
  _tag: Schema.Literal('MetadataUpdated'),
  /** Changed keys and their new values */
  updated: Schema.Record({
    key: Schema.String,
    value: Schema.String,
  }),
  /** Removed keys */
  removed: Schema.Array(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'MetadataUpdated',
    description: 'Artifact metadata update delta',
  })
)
export type MetadataUpdated = typeof MetadataUpdated.Type

/**
 * ViewDeltaPayload - Union of all delta types
 * Uses discriminated union with _tag
 */
export const ViewDeltaPayload = Schema.Union(
  ChannelUpdated,
  ChannelActivated,
  ChannelDeactivated,
  ChannelCleared,
  ArtifactReplaced,
  StateChanged,
  MetadataUpdated
).pipe(
  Schema.annotations({
    title: 'ViewDeltaPayload',
    description: 'Union of all view delta types',
  })
)
export type ViewDeltaPayload = typeof ViewDeltaPayload.Type

// ============================================================================
// View Delta (Incremental Update)
// ============================================================================

/**
 * ViewDelta - Incremental update to a view artifact
 * Proto: ava.artifacts.v1.ViewDelta
 *
 * Used for efficient streaming of changes via NATS.
 */
export const ViewDelta = Schema.Struct({
  /** View this delta applies to */
  viewId: ViewId,
  /** Sequence number for ordering */
  sequence: Schema.Number,
  /** When this delta was generated (ms) */
  timestampMs: TimestampMs,
  /** The actual change */
  delta: ViewDeltaPayload,
}).pipe(
  Schema.annotations({
    title: 'ViewDelta',
    description: 'Incremental update to a view artifact',
  })
)
export type ViewDelta = typeof ViewDelta.Type

// ============================================================================
// Tagged Messages (for multi-view streams)
// ============================================================================

/**
 * TaggedArtifact - Artifact with routing tag for multi-view streams
 */
export const TaggedArtifact = Schema.Struct({
  /** View identifier for demultiplexing */
  viewId: ViewId,
  /** The artifact */
  artifact: ViewArtifact,
  /** Optional client-provided correlation tag */
  tag: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'TaggedArtifact',
    description: 'Artifact with routing tag',
  })
)
export type TaggedArtifact = typeof TaggedArtifact.Type

/**
 * TaggedDelta - Delta with routing tag for multi-view streams
 */
export const TaggedDelta = Schema.Struct({
  /** View identifier for demultiplexing */
  viewId: ViewId,
  /** The delta */
  delta: ViewDelta,
  /** Optional client-provided correlation tag */
  tag: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'TaggedDelta',
    description: 'Delta with routing tag',
  })
)
export type TaggedDelta = typeof TaggedDelta.Type
