/**
 * Derived Graph Factory — Second-tier d2ts computation layer.
 *
 * Consumes normalized output from ingest graph.
 * Runs configurable computations per session/workspace:
 *   - join (cross-source correlation)
 *   - reduce (aggregation)
 *   - count / topK
 *   - window (sliding time)
 *   - throttle (rate limiting)
 *   - iterate (convergence loops)
 *
 * STUB: Graph construction awaits @electric-sql/d2ts installation.
 * Operator pipeline is specified here as pure functions.
 *
 * @see TSINGOU_FLOW_ARCHITECTURE.md §5.1
 * @module tsingou-flow/graph/derived
 */

import type { BaseSignal } from '../schemas/base-signal'

// =============================================================================
// Derived Computation Types
// =============================================================================

/**
 * Result of a cross-source correlation computation.
 */
export interface Correlation {
  readonly sourceA: string
  readonly sourceB: string
  readonly score: number
  readonly signals: ReadonlyArray<BaseSignal>
  readonly computedAt: Date
}

/**
 * Result of a count/aggregation computation.
 */
export interface SignalCount {
  readonly key: string
  readonly count: number
  readonly lastSeen: Date
}

/**
 * Result of an anomaly detection computation.
 */
export interface Anomaly {
  readonly signal: BaseSignal
  readonly anomalyType: 'frequency' | 'value' | 'pattern' | 'missing'
  readonly severity: 'low' | 'medium' | 'high' | 'critical'
  readonly description: string
  readonly detectedAt: Date
}

// =============================================================================
// Derived Operators (pure functions, pre-d2ts)
// =============================================================================

/**
 * Count signals by kind.
 */
export const countByKind = (
  signals: ReadonlyArray<BaseSignal>,
): ReadonlyArray<SignalCount> => {
  const counts = new Map<string, { count: number; lastSeen: Date }>()
  for (const s of signals) {
    const existing = counts.get(s.kind) ?? { count: 0, lastSeen: new Date(0) }
    counts.set(s.kind, {
      count: existing.count + 1,
      lastSeen: s.timestamp > existing.lastSeen ? s.timestamp : existing.lastSeen,
    })
  }
  return Array.from(counts.entries()).map(([key, v]) => ({
    key,
    count: v.count,
    lastSeen: v.lastSeen,
  }))
}

/**
 * Count signals by source.
 */
export const countBySource = (
  signals: ReadonlyArray<BaseSignal>,
): ReadonlyArray<SignalCount> => {
  const counts = new Map<string, { count: number; lastSeen: Date }>()
  for (const s of signals) {
    const existing = counts.get(s.sourceId) ?? { count: 0, lastSeen: new Date(0) }
    counts.set(s.sourceId, {
      count: existing.count + 1,
      lastSeen: s.timestamp > existing.lastSeen ? s.timestamp : existing.lastSeen,
    })
  }
  return Array.from(counts.entries()).map(([key, v]) => ({
    key,
    count: v.count,
    lastSeen: v.lastSeen,
  }))
}

/**
 * Top-K signals by frequency within a time window.
 */
export const topK = (
  signals: ReadonlyArray<BaseSignal>,
  k: number,
  keyFn: (s: BaseSignal) => string = (s) => s.kind,
): ReadonlyArray<SignalCount> => {
  const counts = countByKind(signals)
  return [...counts].sort((a, b) => b.count - a.count).slice(0, k)
}

/**
 * Simple sliding window over signals by timestamp.
 */
export const timeWindow = (
  signals: ReadonlyArray<BaseSignal>,
  windowMs: number,
): ReadonlyArray<BaseSignal> => {
  const cutoff = Date.now() - windowMs
  return signals.filter((s) => s.timestamp.getTime() >= cutoff)
}

// =============================================================================
// D2 Derived Graph Factory (stubbed)
// =============================================================================

/**
 * Create the derived D2 graph.
 *
 * STUB — will create actual D2 instance when @electric-sql/d2ts is installed.
 * For now: exposes pure-function computations.
 */
export const createDerivedGraph = () => ({
  countByKind,
  countBySource,
  topK,
  timeWindow,
})
