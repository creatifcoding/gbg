/**
 * MultiSet<Signal> Constructors & Helpers
 *
 * Helper functions to create d2ts MultiSet entries from Signal objects.
 * MultiSet semantics: event accumulation with +1 for insert, -1 for retract.
 *
 * @see TSINGOU_FLOW_ARCHITECTURE.md §5.3
 * @module tsingou-flow/graph/multiset-helpers
 */

import type { BaseSignal } from '../schemas/base-signal'

// =============================================================================
// MultiSet Type (design-phase stub — will import from @electric-sql/d2ts)
// =============================================================================

/**
 * A MultiSet is a collection of (value, multiplicity) pairs.
 * Positive multiplicity = insertion, negative = retraction.
 *
 * This is a design-phase type that mirrors @electric-sql/d2ts MultiSet.
 * When d2ts is installed, replace with the real import.
 */
export type MultiSetEntry<T> = readonly [T, number]

export interface MultiSet<T> {
  readonly inner: ReadonlyArray<MultiSetEntry<T>>
}

// =============================================================================
// Constructors
// =============================================================================

/**
 * Create a MultiSet from a single signal insertion (+1).
 */
export const fromSignal = (signal: BaseSignal): MultiSet<BaseSignal> => ({
  inner: [[signal, 1]],
})

/**
 * Create a MultiSet from a retraction (-1).
 * Used when a source disconnects or explicitly withdraws data.
 */
export const retractSignal = (signal: BaseSignal): MultiSet<BaseSignal> => ({
  inner: [[signal, -1]],
})

/**
 * Create a MultiSet from a batch of signal insertions.
 */
export const fromBatch = (signals: ReadonlyArray<BaseSignal>): MultiSet<BaseSignal> => ({
  inner: signals.map((s) => [s, 1] as const),
})

/**
 * Create a MultiSet from an array of (signal, multiplicity) pairs.
 */
export const fromEntries = (
  entries: ReadonlyArray<MultiSetEntry<BaseSignal>>,
): MultiSet<BaseSignal> => ({
  inner: entries,
})

/**
 * Empty MultiSet.
 */
export const empty = <T>(): MultiSet<T> => ({ inner: [] })

/**
 * Merge two MultiSets by concatenating their entries.
 * Consolidation (combining entries with same value) is done by d2ts operators.
 */
export const merge = <T>(a: MultiSet<T>, b: MultiSet<T>): MultiSet<T> => ({
  inner: [...a.inner, ...b.inner],
})

/**
 * Count the net multiplicity (total insertions minus total retractions).
 */
export const netCount = <T>(ms: MultiSet<T>): number =>
  ms.inner.reduce((sum, [, mult]) => sum + mult, 0)

/**
 * Extract only positive-multiplicity entries (active signals).
 */
export const activeEntries = <T>(ms: MultiSet<T>): ReadonlyArray<T> =>
  ms.inner.filter(([, mult]) => mult > 0).map(([value]) => value)

/**
 * Transform a MultiSet by mapping values (preserving multiplicities).
 */
export const mapMultiSet = <T, U>(
  ms: MultiSet<T>,
  f: (value: T) => U,
): MultiSet<U> => ({
  inner: ms.inner.map(([value, mult]) => [f(value), mult] as const),
})
