/**
 * Version & Antichain Helpers for d2ts multi-dimensional versioning.
 *
 * Tsingou uses 2-dimensional versions: [tick, source_seq]
 * - Dimension 0: Global logical tick (monotonic per processing cycle)
 * - Dimension 1: Per-source sequence number (independent ordering)
 *
 * This enables partial ordering: sources advance independently without
 * blocking each other, while the global tick provides a synchronization point.
 *
 * @see TSINGOU_FLOW_ARCHITECTURE.md §5.2
 * @module tsingou-flow/graph/version
 */

// =============================================================================
// Re-exports from d2ts (once installed)
// Type stubs for design phase — these will import from @electric-sql/d2ts
// =============================================================================

/**
 * Tsingou version dimensions.
 */
export const TICK_DIM = 0
export const SOURCE_DIM = 1

/**
 * Create a Tsingou version tuple.
 *
 * @param tick - Global logical clock (processing cycle number)
 * @param sourceSeq - Per-source sequence number
 *
 * @example
 * ```typescript
 * const v1 = makeVersion(42, 7)  // tick 42, source seq 7
 * const v2 = makeVersion(42, 8)  // same tick, next source event
 * const v3 = makeVersion(43, 0)  // next tick
 * ```
 */
export const makeVersion = (tick: number, sourceSeq: number): [number, number] =>
  [tick, sourceSeq]

/**
 * Create the initial version (0, 0).
 */
export const initialVersion = (): [number, number] => [0, 0]

/**
 * Advance the tick dimension.
 */
export const advanceTick = (version: [number, number]): [number, number] =>
  [version[TICK_DIM] + 1, version[SOURCE_DIM]]

/**
 * Advance the source dimension.
 */
export const advanceSource = (version: [number, number]): [number, number] =>
  [version[TICK_DIM], version[SOURCE_DIM] + 1]

/**
 * Get the tick component.
 */
export const getTick = (version: [number, number]): number =>
  version[TICK_DIM]

/**
 * Get the source sequence component.
 */
export const getSourceSeq = (version: [number, number]): number =>
  version[SOURCE_DIM]

/**
 * Compare two versions in the partial order.
 * Returns:
 *   -1 if a < b (a is strictly earlier)
 *    0 if a === b (identical)
 *    1 if a > b (a is strictly later)
 *    null if incomparable (concurrent — neither dominates)
 */
export const compareVersions = (
  a: [number, number],
  b: [number, number],
): -1 | 0 | 1 | null => {
  const tickCmp = Math.sign(a[TICK_DIM] - b[TICK_DIM])
  const srcCmp = Math.sign(a[SOURCE_DIM] - b[SOURCE_DIM])

  if (tickCmp === 0 && srcCmp === 0) return 0
  if (tickCmp <= 0 && srcCmp <= 0) return -1
  if (tickCmp >= 0 && srcCmp >= 0) return 1
  return null // Concurrent / incomparable
}
