/**
 * Ingest Graph Factory — First-tier d2ts normalization layer.
 *
 * Responsibilities:
 *   1. Schema validation (filter invalid signals via registry)
 *   2. Timestamp normalization
 *   3. Source metadata tagging
 *   4. Consolidation (collapse duplicate entries)
 *
 * Output: Normalized MultiSet<BaseSignal> fed to derived graph.
 *
 * STUB: Graph construction awaits @electric-sql/d2ts installation.
 * The operator pipeline is fully specified here.
 *
 * @see TSINGOU_FLOW_ARCHITECTURE.md §5.1
 * @module tsingou-flow/graph/ingest
 */

import type { BaseSignal } from '../schemas/base-signal'
import type { MultiSet } from './multiset-helpers'
import { fromBatch, empty } from './multiset-helpers'

// =============================================================================
// Ingest Pipeline Operators (pure functions, composable)
// =============================================================================

/**
 * Validate a signal has required fields.
 * In production, this will delegate to SchemaRegistry.lookup() for dynamic types.
 */
export const isValidSignal = (signal: BaseSignal): boolean =>
  Boolean(
    signal.id &&
    signal.sourceId &&
    signal.kind &&
    signal.timestamp instanceof Date,
  )

/**
 * Normalize timestamp: ensure it's a valid Date, default to now() if missing.
 */
export const normalizeTimestamp = (signal: BaseSignal): BaseSignal => ({
  ...signal,
  timestamp: signal.timestamp instanceof Date && !isNaN(signal.timestamp.getTime())
    ? signal.timestamp
    : new Date(),
})

/**
 * Tag signal with ingestion metadata.
 */
export const tagWithIngestMetadata = (signal: BaseSignal): BaseSignal => ({
  ...signal,
  metadata: {
    ...((signal.metadata as Record<string, unknown>) ?? {}),
    _ingestedAt: new Date().toISOString(),
    _pipeline: 'tsingou-ingest',
  } as any,
})

// =============================================================================
// Ingest Pipeline (synchronous, for pre-d2ts pass-through mode)
// =============================================================================

/**
 * Process a batch of signals through the ingest pipeline.
 *
 * When d2ts is installed, this becomes:
 *   input.pipe(filter(isValidSignal), map(normalizeTimestamp), map(tagWithIngestMetadata), consolidate())
 *
 * For now: pure function pipeline operating on arrays.
 */
export const processIngestBatch = (
  signals: ReadonlyArray<BaseSignal>,
): ReadonlyArray<BaseSignal> =>
  signals
    .filter(isValidSignal)
    .map(normalizeTimestamp)
    .map(tagWithIngestMetadata)

/**
 * Process a batch and return as MultiSet.
 */
export const ingestToMultiSet = (
  signals: ReadonlyArray<BaseSignal>,
): MultiSet<BaseSignal> => {
  const processed = processIngestBatch(signals)
  return processed.length > 0 ? fromBatch(processed) : empty()
}

// =============================================================================
// D2 Graph Factory (stubbed)
// =============================================================================

/**
 * Create the ingest D2 graph.
 *
 * STUB — will create actual D2 instance when @electric-sql/d2ts is installed:
 *
 * ```typescript
 * const graph = new D2({ initialFrontier: v([0, 0]) })
 * const input = graph.newInput<BaseSignal>()
 * const output = input.pipe(
 *   filter(isValidSignal),
 *   map(normalizeTimestamp),
 *   map(tagWithIngestMetadata),
 *   consolidate(),
 * )
 * return { graph, input, output }
 * ```
 */
export const createIngestGraph = () => {
  // Placeholder until d2ts is installed
  return {
    /** Process signals synchronously (pre-d2ts) */
    process: processIngestBatch,
    /** Process and return as MultiSet */
    processToMultiSet: ingestToMultiSet,
  }
}
