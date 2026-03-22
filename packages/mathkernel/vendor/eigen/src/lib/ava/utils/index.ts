/**
 * AVA Utilities Module
 *
 * Shared utilities for AVA operations including tracing,
 * error handling, delta processing, and common patterns.
 *
 * @module
 */

// Tracing utilities
export {
  // Types
  type AvaDomain,
  type TracedOperationMeta,
  // Core traced fn
  avaFn,
  avaFnWithMeta,
  // Span utilities
  withAvaSpan,
  annotateAvaSpan,
  logAvaEvent,
  // Domain-specific traced ops
  subscriptionOps,
  artifactOps,
  channelOps,
  natsOps,
  // Dev utilities
  withAvaTraceLog,
} from './traced'

// Delta matching utilities (Effect.Match patterns)
export {
  // Types
  type DeltaCategory,
  type DeltaLogEntry,
  type ArtifactUpdate,
  // Categorization
  categorizeDelta,
  deltaToLogEntry,
  // Predicates
  isDataDelta,
  isLifecycleDelta,
  isStateDelta,
  isSnapshotDelta,
  isArtifactLevelDelta,
  // Reducers
  computeArtifactUpdate,
  applyDeltaReducer,
  // Extraction
  extractChannelId,
  forChannel,
} from './delta-matching'
