/**
 * AVA v2 Delta Matching Utilities
 *
 * Effect.Match-based pattern matching for ViewDeltaPayload discriminated unions.
 * Provides type-safe handlers for all delta types.
 *
 * @pattern Effect.Match for discriminated unions
 * @see .edin/EFFECT_MATCH_PATTERN.md
 * @module
 */

import { Match } from 'effect'
import type {
  ViewDeltaPayload,
  ViewArtifact,
  ChannelId,
  ArtifactState,
} from '../schemas/v2'

// =============================================================================
// Types
// =============================================================================

export interface DeltaCategory {
  readonly type: 'data' | 'lifecycle' | 'state' | 'snapshot' | 'metadata'
  readonly message: string
}

export interface DeltaLogEntry {
  readonly type: 'data' | 'lifecycle' | 'state' | 'snapshot' | 'metadata'
  readonly level: 'info' | 'warn' | 'error'
  readonly message: string
  readonly channelId?: ChannelId
  readonly isFullRefresh?: boolean
  readonly rowCount?: number
  readonly previousState?: ArtifactState
  readonly newState?: ArtifactState
  readonly newVersion?: number
}

export interface ArtifactUpdate {
  readonly type: 'channel' | 'state' | 'replace' | 'metadata' | 'none'
  readonly newArtifact?: ViewArtifact
  readonly channelId?: ChannelId
  readonly rowCount?: number
  readonly newState?: ArtifactState
}

// =============================================================================
// Delta Categorization
// =============================================================================

/**
 * Categorize a delta payload by its semantic type.
 * Uses Effect.Match for exhaustive pattern matching.
 *
 * @example
 * ```ts
 * const category = categorizeDelta(delta.delta)
 * console.log(`${category.type}: ${category.message}`)
 * ```
 */
export const categorizeDelta = Match.type<ViewDeltaPayload>().pipe(
  Match.tag('ChannelUpdated', (delta) => ({
    type: 'data' as const,
    message: `Channel ${delta.channelId} updated with ${delta.rowCount} rows${delta.isFullRefresh ? ' (full refresh)' : ''}`,
  })),
  Match.tag('ChannelActivated', (delta) => ({
    type: 'lifecycle' as const,
    message: `Channel ${delta.channelId} activated as ${delta.role}`,
  })),
  Match.tag('ChannelDeactivated', (delta) => ({
    type: 'lifecycle' as const,
    message: `Channel ${delta.channelId} deactivated: ${delta.reason}`,
  })),
  Match.tag('ChannelCleared', (delta) => ({
    type: 'lifecycle' as const,
    message: `Channel ${delta.channelId} cleared: ${delta.reason}`,
  })),
  Match.tag('ArtifactReplaced', (delta) => ({
    type: 'snapshot' as const,
    message: `Artifact replaced (reason: ${delta.reason}), new version: ${delta.newArtifact.version}`,
  })),
  Match.tag('StateChanged', (delta) => ({
    type: 'state' as const,
    message: `State changed: ${delta.previousState} -> ${delta.newState}${delta.reason ? ` (${delta.reason})` : ''}`,
  })),
  Match.tag('MetadataUpdated', (delta) => ({
    type: 'metadata' as const,
    message: `Metadata updated: ${Object.keys(delta.updated).length} keys changed, ${delta.removed.length} removed`,
  })),
  Match.exhaustive
)

// =============================================================================
// Delta Logging
// =============================================================================

/**
 * Convert a delta to a structured log entry.
 * Uses Effect.Match for exhaustive handling with log levels.
 *
 * @example
 * ```ts
 * const entry = deltaToLogEntry(delta.delta)
 * if (entry.level === 'error') {
 *   console.error(entry.message)
 * }
 * ```
 */
export const deltaToLogEntry = Match.type<ViewDeltaPayload>().pipe(
  Match.tag('ChannelUpdated', (delta) => ({
    type: 'data' as const,
    level: 'info' as const,
    message: `Channel ${delta.channelId}: ${delta.rowCount} rows`,
    channelId: delta.channelId,
    isFullRefresh: delta.isFullRefresh,
    rowCount: delta.rowCount,
  })),
  Match.tag('ChannelActivated', (delta) => ({
    type: 'lifecycle' as const,
    level: 'info' as const,
    message: `Channel ${delta.channelId} activated`,
    channelId: delta.channelId,
  })),
  Match.tag('ChannelDeactivated', (delta) => ({
    type: 'lifecycle' as const,
    level: 'warn' as const,
    message: `Channel ${delta.channelId} deactivated: ${delta.reason}`,
    channelId: delta.channelId,
  })),
  Match.tag('ChannelCleared', (delta) => ({
    type: 'lifecycle' as const,
    level: 'warn' as const,
    message: `Channel ${delta.channelId} cleared`,
    channelId: delta.channelId,
  })),
  Match.tag('ArtifactReplaced', (delta) => ({
    type: 'snapshot' as const,
    level: 'info' as const,
    message: `Artifact replaced: ${delta.reason}`,
    newVersion: delta.newArtifact.version,
  })),
  Match.tag('StateChanged', (delta) => ({
    type: 'state' as const,
    level: delta.newState === 'SUSPENDED' ? ('warn' as const) : ('info' as const),
    message: `State: ${delta.previousState} -> ${delta.newState}`,
    previousState: delta.previousState,
    newState: delta.newState,
  })),
  Match.tag('MetadataUpdated', () => ({
    type: 'metadata' as const,
    level: 'info' as const,
    message: 'Metadata updated',
  })),
  Match.exhaustive
)

// =============================================================================
// Delta Type Predicates
// =============================================================================

/**
 * Check if a delta represents a data change (channel updated).
 */
export const isDataDelta = Match.type<ViewDeltaPayload>().pipe(
  Match.tag('ChannelUpdated', () => true),
  Match.orElse(() => false)
)

/**
 * Check if a delta represents a lifecycle event.
 */
export const isLifecycleDelta = Match.type<ViewDeltaPayload>().pipe(
  Match.tag('ChannelActivated', 'ChannelDeactivated', 'ChannelCleared', () => true),
  Match.orElse(() => false)
)

/**
 * Check if a delta represents a state change.
 */
export const isStateDelta = Match.type<ViewDeltaPayload>().pipe(
  Match.tag('StateChanged', () => true),
  Match.orElse(() => false)
)

/**
 * Check if a delta is a full artifact replacement.
 */
export const isSnapshotDelta = Match.type<ViewDeltaPayload>().pipe(
  Match.tag('ArtifactReplaced', () => true),
  Match.orElse(() => false)
)

// =============================================================================
// Artifact Reducer
// =============================================================================

/**
 * Apply a delta to an artifact, returning the update instruction.
 * Uses Effect.Match for type-safe delta handling.
 *
 * This is a pure function - it returns what should change, not the new artifact.
 * The caller applies the change to the actual state.
 *
 * @example
 * ```ts
 * const update = applyDeltaToArtifact(currentArtifact, delta.delta)
 * if (update.type === 'replace') {
 *   setArtifact(update.newArtifact!)
 * } else if (update.type === 'state') {
 *   setArtifact({ ...currentArtifact, state: update.newState! })
 * }
 * ```
 */
export const computeArtifactUpdate = (
  _currentArtifact: ViewArtifact,
  delta: ViewDeltaPayload
): ArtifactUpdate => {
  return Match.value(delta).pipe(
    Match.tag('ChannelUpdated', (d) => ({
      type: 'channel' as const,
      channelId: d.channelId,
      rowCount: d.rowCount,
    })),
    Match.tag('ChannelActivated', (d) => ({
      type: 'channel' as const,
      channelId: d.channelId,
    })),
    Match.tag('ChannelDeactivated', (d) => ({
      type: 'channel' as const,
      channelId: d.channelId,
    })),
    Match.tag('ChannelCleared', (d) => ({
      type: 'channel' as const,
      channelId: d.channelId,
    })),
    Match.tag('ArtifactReplaced', (d) => ({
      type: 'replace' as const,
      newArtifact: d.newArtifact,
    })),
    Match.tag('StateChanged', (d) => ({
      type: 'state' as const,
      newState: d.newState,
    })),
    Match.tag('MetadataUpdated', () => ({
      type: 'metadata' as const,
    })),
    Match.exhaustive
  )
}

/**
 * Apply a delta to an artifact, returning the new artifact.
 * This is a pure reducer function for immutable state updates.
 *
 * @example
 * ```ts
 * const newArtifact = applyDeltaReducer(currentArtifact, delta.delta)
 * ctx.set(artifactsAtom, HashMap.set(artifacts, viewId, newArtifact))
 * ```
 */
export const applyDeltaReducer = (
  artifact: ViewArtifact,
  delta: ViewDeltaPayload
): ViewArtifact => {
  return Match.value(delta).pipe(
    Match.tag('ChannelUpdated', (d) => ({
      ...artifact,
      channelBindings: artifact.channelBindings.map((b) =>
        b.channelId === d.channelId
          ? { ...b, rowCount: d.rowCount, lastUpdatedMs: d.timestampMs }
          : b
      ),
      updatedAtMs: d.timestampMs,
    })),
    Match.tag('ChannelActivated', (d) => ({
      ...artifact,
      channelBindings: artifact.channelBindings.map((b) =>
        b.channelId === d.channelId
          ? { ...b, active: true, role: d.role }
          : b
      ),
    })),
    Match.tag('ChannelDeactivated', (d) => ({
      ...artifact,
      channelBindings: artifact.channelBindings.map((b) =>
        b.channelId === d.channelId
          ? { ...b, active: false }
          : b
      ),
    })),
    Match.tag('ChannelCleared', (d) => ({
      ...artifact,
      channelBindings: artifact.channelBindings.map((b) =>
        b.channelId === d.channelId
          ? { ...b, data: undefined, rowCount: undefined }
          : b
      ),
    })),
    Match.tag('ArtifactReplaced', (d) => d.newArtifact),
    Match.tag('StateChanged', (d) => ({
      ...artifact,
      state: d.newState,
    })),
    Match.tag('MetadataUpdated', (d) => {
      // Filter out removed keys and merge updated keys
      const currentMetadata = artifact.metadata ?? {}
      const filteredMetadata = Object.fromEntries(
        Object.entries(currentMetadata).filter(([key]) => !d.removed.includes(key))
      )
      return {
        ...artifact,
        metadata: {
          ...filteredMetadata,
          ...d.updated,
        },
      }
    }),
    Match.exhaustive
  )
}

// =============================================================================
// Channel ID Extraction
// =============================================================================

/**
 * Extract the channelId from a delta if it's a channel-related delta.
 * Returns undefined for artifact-level deltas.
 */
export const extractChannelId = Match.type<ViewDeltaPayload>().pipe(
  Match.tag('ChannelUpdated', (d) => d.channelId),
  Match.tag('ChannelActivated', (d) => d.channelId),
  Match.tag('ChannelDeactivated', (d) => d.channelId),
  Match.tag('ChannelCleared', (d) => d.channelId),
  Match.orElse(() => undefined)
)

// =============================================================================
// Delta Stream Filtering
// =============================================================================

/**
 * Create a filter predicate for a specific channel's deltas.
 */
export const forChannel = (channelId: ChannelId) => (delta: ViewDeltaPayload): boolean => {
  return Match.value(delta).pipe(
    Match.tag('ChannelUpdated', (d) => d.channelId === channelId),
    Match.tag('ChannelActivated', (d) => d.channelId === channelId),
    Match.tag('ChannelDeactivated', (d) => d.channelId === channelId),
    Match.tag('ChannelCleared', (d) => d.channelId === channelId),
    Match.orElse(() => false)
  )
}

/**
 * Create a filter predicate for artifact-level deltas (not channel-specific).
 */
export const isArtifactLevelDelta = Match.type<ViewDeltaPayload>().pipe(
  Match.tag('ArtifactReplaced', 'StateChanged', 'MetadataUpdated', () => true),
  Match.orElse(() => false)
)
