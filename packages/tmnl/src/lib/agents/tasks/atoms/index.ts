/**
 * Agent Task Atoms — default atom surface exports.
 *
 * This module preserves the existing import surface used by views/components,
 * while delegating construction to the DI-able atom surface factory.
 *
 * For dependency injection, use `AgentTaskLogAtomSurface` from `./surface`.
 *
 * @module agent-task/atoms
 */

import { AgentTaskServiceMock } from '../services/layers'
import {
  createAgentTaskLogAtomSurfaceAtoms,
  DEFAULT_FILTER,
  type LogFilterState,
  type TailMode,
} from './surface'

const defaultAtoms = createAgentTaskLogAtomSurfaceAtoms(AgentTaskServiceMock)

// ---------------------------------------------------------------------------
// Backward-compatible named exports (current consumers)
// ---------------------------------------------------------------------------

export { DEFAULT_FILTER, type LogFilterState, type TailMode }

export const logRuntimeAtom = defaultAtoms.logRuntimeAtom
export const logBufferFamily = defaultAtoms.logBufferFamily
export const logStreamTrigger = defaultAtoms.logStreamTrigger
export const logFilterAtom = defaultAtoms.logFilterAtom
export const tailModeFamily = defaultAtoms.tailModeFamily
export const unreadCountFamily = defaultAtoms.unreadCountFamily
export const outboxPendingFamily = defaultAtoms.outboxPendingFamily
export const outboxInFlightFamily = defaultAtoms.outboxInFlightFamily
export const outboxRetryCountFamily = defaultAtoms.outboxRetryCountFamily
export const outboxDroppedCountFamily = defaultAtoms.outboxDroppedCountFamily
export const outboxDegradedFamily = defaultAtoms.outboxDegradedFamily
export const outboxMetricsFamily = defaultAtoms.outboxMetricsFamily
export const durabilityAckMetricsFamily = defaultAtoms.durabilityAckMetricsFamily
export const archivePendingCountFamily = defaultAtoms.archivePendingCountFamily
export const archiveDegradedFamily = defaultAtoms.archiveDegradedFamily
export const hydrationCacheFamily = defaultAtoms.hydrationCacheFamily
export const hydrationLoadingFamily = defaultAtoms.hydrationLoadingFamily
export const hydrationErrorFamily = defaultAtoms.hydrationErrorFamily
export const hydrationMetricsFamily = defaultAtoms.hydrationMetricsFamily
export const hydrateWindowTrigger = defaultAtoms.hydrateWindowTrigger
export const filteredLogBufferFamily = defaultAtoms.filteredLogBufferFamily
export const logCountFamily = defaultAtoms.logCountFamily
export const logTotalCountFamily = defaultAtoms.logTotalCountFamily

// ---------------------------------------------------------------------------
// DI-able surface exports
// ---------------------------------------------------------------------------

export {
  AgentTaskLogAtomSurface,
  AgentTaskLogAtomSurfaceMock,
  AgentTaskLogAtomSurfaceNats,
  AgentTaskLogAtomSurfaceNatsMicro,
  AgentTaskLogAtomSurfaceCustom,
  createAgentTaskLogAtomSurfaceAtoms,
  createAgentTaskLogAtomSurfaceRuntime,
  agentTaskLogSurfaceMockRuntime,
  agentTaskLogSurfaceNatsRuntime,
  agentTaskLogSurfaceNatsMicroRuntime,
  type AgentTaskLogAtomSurfaceAtoms,
  type AgentTaskLogAtomSurfaceShape,
  type AgentTaskLogAtomSurfaceRuntime,
  type OutboxMetrics,
  type ArchiveSpillPendingEntry,
  type DurabilityAckLatencyBuckets,
  type DurabilityAckMetrics,
  type HydrationCachePolicy,
  type HydrationCacheEntry,
  type HydrationMetrics,
  DEFAULT_HYDRATION_CACHE_POLICY,
  ARCHIVE_SPILL_CHECKPOINT_SIZE,
  ARCHIVE_REDACTED_VALUE,
  EMPTY_DURABILITY_ACK_BUCKETS,
  EMPTY_DURABILITY_ACK_METRICS,
  hydrationWindowCacheKey,
  pruneHydrationCacheEntries,
  upsertHydrationCacheEntry,
  recordDurabilityAckLatency,
  shouldSpillArchiveCheckpoint,
  buildArchiveChunkFromAckedBatch,
  advanceArchiveManifestAfterChunk,
  redactArchiveValue,
  redactArchiveEntry,
} from './surface'

// ---------------------------------------------------------------------------
// View state/action atoms
// ---------------------------------------------------------------------------

export {
  taskViewModeFamily,
  viewOrder,
  getSlideDirection,
  type TaskViewMode,
} from './view-state'

export {
  taskStatusFamily,
  taskActionsFamily,
  getActionsForStatus,
  type TaskAction,
  type ActionVariant,
} from './task-actions'
