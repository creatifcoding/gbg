/**
 * Render Tracking System
 *
 * Module-level render tracking with leak detection, rate calculation,
 * and severity classification. This is the instrumentation layer for
 * validating React component render behavior during EDIN experiments.
 *
 * @provenance
 * ────────────────────────────────────────────────────────────────────────────
 * EXTRACTED FROM: EffectAtomTestbed.tsx:22-220, 236-472, 3764-3882
 * DATE: 2025-12-02
 * AUTHOR: Val (AG-Grid Integration Architect)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * DISCOVERY CONTEXT:
 * During Effect-Atom integration testing, we discovered critical antipatterns
 * that caused infinite render loops. This render tracking system was built
 * iteratively to diagnose and prevent these issues.
 *
 * ANTIPATTERN DISCOVERED (H3.4a):
 * ────────────────────────────────────────────────────────────────────────────
 * Using Atom.family with useAtom for render tracking caused infinite loops:
 *
 *   1. useAtom(trackingAtom) SUBSCRIBES to atom
 *   2. useEffect updates atom on every render
 *   3. Subscription triggers re-render → infinite loop
 *
 * FIX: Module-level Map for synchronous tracking (no subscriptions),
 * useState + setInterval for display polling (isolated to badge component).
 * ────────────────────────────────────────────────────────────────────────────
 *
 * LEAK DETECTION THRESHOLDS:
 * ────────────────────────────────────────────────────────────────────────────
 * - IDLE:     0 RPS (nothing happening)
 * - NORMAL:   < 0.5 RPS (user interactions)
 * - EXPECTED: ~1 RPS (stream emits, expected behavior)
 * - WARNING:  2-5 RPS (possible cascade)
 * - CRITICAL: > 5 RPS (definite leak)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * COMPONENT INVENTORY:
 * ────────────────────────────────────────────────────────────────────────────
 * HOOKS:
 * - useTrackRender(key)      - Synchronous render tracking (no state)
 * - useRenderStats(key)      - Polling-based stats for display
 * - useAggregatedRenderStats - Global stats across all keys
 *
 * FUNCTIONS:
 * - getTrackingState(key)    - Get/init tracking for a key
 * - calculateSeverity(rps)   - Classify RPS into severity level
 * - resetRenderTracking(key) - Reset single key
 * - resetAllRenderTracking() - Reset all keys
 *
 * COMPONENTS:
 * - RenderBadge              - Compact render count + RPS display
 * - TrackedSection           - Wrapper that tracks its own renders
 * - TrackedCard              - Card variant with tracking
 * - GlobalRenderCounter      - Master dashboard with breakdown
 * ────────────────────────────────────────────────────────────────────────────
 *
 * RATIONALE:
 * This extraction preserves the full diagnostic capability of the original
 * render tracking system while making it reusable across testbeds. The
 * module-level Map pattern is essential - DO NOT refactor to atoms.
 *
 * The GlobalRenderCounter is particularly valuable for debugging cascades
 * across hypothesis sections. It shows per-key breakdown with severity
 * indicators and a "⚠ LEAK" warning when critical threshold is breached.
 *
 * USAGE:
 * ```tsx
 * import { useTrackRender, RenderBadge, GlobalRenderCounter } from './render-tracking'
 *
 * function MyComponent() {
 *   useTrackRender('my-key')  // Call in component body (synchronous)
 *   return <div>...</div>
 * }
 *
 * // In header/toolbar:
 * <GlobalRenderCounter />
 * ```
 *
 * @see EffectAtomTestbed.tsx for H3_2_ANTIPATTERNS documentation
 * @see hypothesis.tsx for non-tracked validation components
 */

import { useEffect, useState, type ReactNode } from 'react'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Tracking key for hypothesis sections.
 *
 * Convention:
 * - Main hypotheses: h1, h2, h3, h4, ...
 * - Sub-hypotheses: h6_1, h6_2, h6_3 (for H6.1, H6.2, H6.3)
 * - Special streams: h3Stream, h4Stream
 * - Custom keys: any string for non-hypothesis tracking
 */
export type TrackingKey = string

/**
 * Leak severity classification based on renders-per-second
 */
export type LeakSeverity = 'idle' | 'normal' | 'expected' | 'warning' | 'critical'

/**
 * Internal state for render tracking
 */
interface RenderTrackingState {
  count: number
  timestamps: number[] // Rolling window for rate calculation
}

/**
 * Stats returned from useRenderStats
 */
export interface RenderStats {
  count: number
  rps: number
  severity: LeakSeverity
}

/**
 * Aggregated stats across all keys
 */
export interface AggregatedRenderStats {
  total: number
  overallRPS: number
  severity: LeakSeverity
  byKey: Record<string, number>
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Rolling window size for RPS calculation (5 seconds) */
const RATE_WINDOW_MS = 5000

/** Severity color configuration for UI */
export const SEVERITY_COLORS: Record<LeakSeverity, { bg: string; text: string; border: string }> = {
  idle: { bg: 'bg-neutral-800/50', text: 'text-neutral-400', border: 'border-neutral-700' },
  normal: { bg: 'bg-neutral-800/50', text: 'text-cyan-400', border: 'border-neutral-700' },
  expected: { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-700/50' },
  warning: { bg: 'bg-amber-900/30', text: 'text-amber-400', border: 'border-amber-700/50' },
  critical: { bg: 'bg-red-900/50', text: 'text-red-400', border: 'border-red-700/50' },
}

// =============================================================================
// MODULE-LEVEL STORAGE
// =============================================================================

/**
 * Module-level storage for render tracking.
 * NO React state = NO subscriptions = NO infinite loops
 *
 * This is the key insight from H3.4a: tracking must be synchronous
 * and not trigger React's subscription/update cycle.
 */
const renderTrackingStore = new Map<TrackingKey, RenderTrackingState>()

/** Registry of all known keys (for aggregation) */
const registeredKeys = new Set<TrackingKey>()

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Get or initialize tracking state for a key
 */
export function getTrackingState(key: TrackingKey): RenderTrackingState {
  if (!renderTrackingStore.has(key)) {
    renderTrackingStore.set(key, { count: 0, timestamps: [] })
    registeredKeys.add(key)
  }
  return renderTrackingStore.get(key)!
}

/**
 * Calculate severity based on renders-per-second
 *
 * @param rps - Renders per second
 * @param isStream - Whether this key tracks a stream (expects ~1 RPS)
 */
export function calculateSeverity(rps: number, isStream: boolean = false): LeakSeverity {
  if (rps === 0) return 'idle'
  if (rps < 0.5) return 'normal'
  if (isStream && rps >= 0.8 && rps <= 1.5) return 'expected' // Stream emits ~1/s
  if (rps < 2) return 'normal'
  if (rps < 5) return 'warning'
  return 'critical'
}

/**
 * Reset tracking for a specific key
 */
export function resetRenderTracking(key: TrackingKey): void {
  renderTrackingStore.set(key, { count: 0, timestamps: [] })
}

/**
 * Reset all render tracking
 */
export function resetAllRenderTracking(): void {
  registeredKeys.forEach(key => {
    renderTrackingStore.set(key, { count: 0, timestamps: [] })
  })
}

/**
 * Get all registered tracking keys
 */
export function getRegisteredKeys(): TrackingKey[] {
  return Array.from(registeredKeys)
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Track renders for a key - SYNCHRONOUS, no state updates, no subscriptions
 *
 * IMPORTANT: This runs synchronously during render.
 * It does NOT cause re-renders because it doesn't update React state.
 *
 * Call this in the component body (not in useEffect):
 * ```tsx
 * function MyComponent() {
 *   useTrackRender('my-key')  // ← Here, at top of component
 *   return <div>...</div>
 * }
 * ```
 */
export function useTrackRender(key: TrackingKey): void {
  // Synchronously increment on every render (no React state!)
  const state = getTrackingState(key)
  const now = Date.now()
  const cutoff = now - RATE_WINDOW_MS

  // Mutate in place (safe because it's module-level, not React state)
  state.count += 1
  state.timestamps = state.timestamps.filter(t => t > cutoff).concat(now)
}

/**
 * Read render stats via polling.
 * Each consumer polls independently - isolated local state.
 *
 * @param key - Tracking key to monitor
 * @param pollInterval - Polling interval in ms (default: 500)
 */
export function useRenderStats(key: TrackingKey, pollInterval: number = 500): RenderStats {
  const [stats, setStats] = useState<RenderStats>({ count: 0, rps: 0, severity: 'idle' })

  useEffect(() => {
    const interval = setInterval(() => {
      const state = getTrackingState(key)
      const now = Date.now()
      const cutoff = now - RATE_WINDOW_MS
      const recentTimestamps = state.timestamps.filter(t => t > cutoff)
      const rps = recentTimestamps.length / (RATE_WINDOW_MS / 1000)
      const isStream = key.toLowerCase().includes('stream')

      setStats({
        count: state.count,
        rps,
        severity: calculateSeverity(rps, isStream),
      })
    }, pollInterval)

    // Initial read
    const state = getTrackingState(key)
    setStats({ count: state.count, rps: 0, severity: 'idle' })

    return () => clearInterval(interval)
  }, [key, pollInterval])

  return stats
}

/**
 * Get aggregated stats across all tracked keys.
 * Uses polling for display.
 *
 * @param pollInterval - Polling interval in ms (default: 500)
 */
export function useAggregatedRenderStats(pollInterval: number = 500): AggregatedRenderStats {
  const [stats, setStats] = useState<AggregatedRenderStats>({
    total: 0,
    overallRPS: 0,
    severity: 'idle',
    byKey: {},
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const cutoff = now - RATE_WINDOW_MS
      const keys = getRegisteredKeys()

      let total = 0
      let allTimestamps: number[] = []
      const byKey: Record<string, number> = {}

      keys.forEach(key => {
        const state = getTrackingState(key)
        total += state.count
        byKey[key] = state.count
        allTimestamps = allTimestamps.concat(state.timestamps.filter(t => t > cutoff))
      })

      const overallRPS = allTimestamps.length / (RATE_WINDOW_MS / 1000)

      let severity: LeakSeverity = 'idle'
      if (overallRPS > 10) severity = 'critical'
      else if (overallRPS > 5) severity = 'warning'
      else if (overallRPS > 0) severity = 'normal'

      setStats({
        total,
        overallRPS,
        severity,
        byKey,
      })
    }, pollInterval)

    return () => clearInterval(interval)
  }, [pollInterval])

  return stats
}

// =============================================================================
// COMPONENTS
// =============================================================================

export interface RenderBadgeProps {
  /** Tracking key to display stats for */
  trackingKey: TrackingKey
  /** Optional label override (defaults to key.toUpperCase()) */
  label?: string
  /** Expected mount render count (shows warning if exceeded) */
  expectedMounts?: number
  className?: string
}

/**
 * Compact render badge showing count, RPS, and severity.
 *
 * Displays:
 * - Warning triangle if count exceeds expectedMounts
 * - Tracking label
 * - Render count (tabular-nums)
 * - @RPS if > 0
 * - Severity indicator dot (warning/critical/expected)
 */
export function RenderBadge({
  trackingKey,
  label,
  expectedMounts = 1,
  className = '',
}: RenderBadgeProps) {
  const { count, rps, severity } = useRenderStats(trackingKey)

  const colors = SEVERITY_COLORS[severity]
  const displayLabel = label ?? trackingKey.replace('_', '.').toUpperCase()
  const isOverExpected = count > expectedMounts

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded
        font-mono uppercase tracking-wider
        border transition-colors
        ${colors.bg} ${colors.border} ${className}
      `}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      title={isOverExpected
        ? `Expected ${expectedMounts} mount render(s), got ${count}`
        : `${count} render(s)`
      }
    >
      {/* Warning indicator when over expected */}
      {isOverExpected && (
        <span className="text-amber-400" title={`Over expected (${expectedMounts})`}>
          ⚠
        </span>
      )}

      <span className="text-neutral-500">{displayLabel}</span>
      <span className={`tabular-nums font-semibold ${colors.text}`}>{count}</span>

      {rps > 0 && (
        <span className="text-neutral-600 tabular-nums">
          @{rps.toFixed(1)}
        </span>
      )}

      {severity !== 'idle' && severity !== 'normal' && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            severity === 'critical' ? 'bg-red-500 animate-pulse' :
            severity === 'warning' ? 'bg-amber-500' :
            severity === 'expected' ? 'bg-green-500' :
            'bg-neutral-500'
          }`}
        />
      )}
    </div>
  )
}

export interface TrackedSectionProps {
  children: ReactNode
  /** Tracking key for this section */
  trackingKey: TrackingKey
  /** Optional label for badge */
  label?: string
  /** Expected mount count */
  expectedMounts?: number
  className?: string
}

/**
 * Container that tracks its own renders with badge positioned bottom-right.
 */
export function TrackedSection({
  children,
  trackingKey,
  label,
  expectedMounts = 1,
  className = '',
}: TrackedSectionProps) {
  // Track renders for this section
  useTrackRender(trackingKey)

  return (
    <div className={`relative ${className}`}>
      {children}
      <div className="absolute bottom-2 right-2">
        <RenderBadge
          trackingKey={trackingKey}
          label={label}
          expectedMounts={expectedMounts}
        />
      </div>
    </div>
  )
}

export interface TrackedCardProps {
  id: string
  title: string
  description: string
  trackingKey: TrackingKey
  expectedMounts?: number
  validated: boolean
  children: ReactNode
  className?: string
}

/**
 * Card with integrated render tracking and validation status.
 */
export function TrackedCard({
  id,
  title,
  description,
  trackingKey,
  expectedMounts = 1,
  validated,
  children,
  className = '',
}: TrackedCardProps) {
  // Track renders for this card
  useTrackRender(trackingKey)

  return (
    <div className={`relative p-4 bg-neutral-800/50 border border-neutral-700 rounded ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`font-mono px-1.5 py-0.5 rounded ${
                validated ? 'bg-green-900/50 text-green-400' : 'bg-neutral-700 text-neutral-400'
              }`}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {id}
            </span>
            <span
              className="text-neutral-300 font-mono"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {title}
            </span>
          </div>
          <p
            className="text-neutral-500 mt-1"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {description}
          </p>
        </div>
      </div>

      {/* Content */}
      {children}

      {/* Badge - bottom right */}
      <div className="absolute bottom-2 right-2">
        <RenderBadge
          trackingKey={trackingKey}
          label={id}
          expectedMounts={expectedMounts}
        />
      </div>
    </div>
  )
}

export interface GlobalRenderCounterProps {
  className?: string
}

/**
 * Master dashboard showing aggregated render stats with per-key breakdown.
 *
 * Features:
 * - Total render count with RPS
 * - Severity indicator (⚠ LEAK when critical)
 * - Expandable breakdown by tracking key
 * - Legend showing threshold values
 * - Reset button to clear all counters
 */
export function GlobalRenderCounter({ className = '' }: GlobalRenderCounterProps) {
  const { total, overallRPS, severity, byKey } = useAggregatedRenderStats()
  const [expanded, setExpanded] = useState(false)

  const colors = SEVERITY_COLORS[severity]

  // Get per-key rates for detailed display
  const keyStats = getRegisteredKeys().map(key => {
    const count = byKey[key] || 0
    const state = getTrackingState(key)
    const now = Date.now()
    const cutoff = now - RATE_WINDOW_MS
    const recentTimestamps = state.timestamps.filter(t => t > cutoff)
    const rps = recentTimestamps.length / (RATE_WINDOW_MS / 1000)
    const isStream = key.toLowerCase().includes('stream')
    const keySeverity = calculateSeverity(rps, isStream)
    return { key, count, rps, severity: keySeverity }
  }).filter(s => s.count > 0 || s.rps > 0) // Only show active keys

  return (
    <div className={`flex flex-col items-end gap-1 ${className}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 px-3 py-1.5 border rounded font-mono transition-colors ${colors.bg} ${colors.border}`}
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      >
        <span className="text-neutral-400">RENDERS:</span>
        <span className={`font-semibold tabular-nums ${colors.text}`}>
          {total}
        </span>
        {overallRPS > 0 && (
          <span className="text-neutral-500 tabular-nums" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            @ {overallRPS.toFixed(1)}/s
          </span>
        )}
        {severity === 'critical' && (
          <span className="text-red-400 animate-pulse" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>⚠ LEAK</span>
        )}
        {severity === 'warning' && (
          <span className="text-amber-400" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>⚠</span>
        )}
        <span className="text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div
          className="bg-neutral-900/95 border border-neutral-700 rounded p-3 font-mono space-y-2 min-w-[240px] shadow-xl"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <span className="text-neutral-500 uppercase tracking-wider">
              Render Analysis
            </span>
          </div>

          {/* Per-key breakdown */}
          <div className="space-y-1.5">
            {keyStats.length === 0 ? (
              <div className="text-neutral-600 text-center py-2">No renders yet</div>
            ) : (
              keyStats.map(({ key, count, rps, severity: keySeverity }) => {
                const rowColors = SEVERITY_COLORS[keySeverity]
                const label = key.replace('_', '.').toUpperCase()
                return (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-neutral-400">{label}:</span>
                    <div className="flex items-center gap-2">
                      <span className={`tabular-nums ${rowColors.text}`}>
                        {count}
                      </span>
                      {rps > 0 && (
                        <span className={`tabular-nums ${
                          keySeverity === 'critical' ? 'text-red-400' :
                          keySeverity === 'warning' ? 'text-amber-400' :
                          keySeverity === 'expected' ? 'text-green-400' :
                          'text-neutral-500'
                        }`} style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                          @{rps.toFixed(1)}/s
                        </span>
                      )}
                      {keySeverity !== 'idle' && keySeverity !== 'normal' && (
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          keySeverity === 'critical' ? 'bg-red-500 animate-pulse' :
                          keySeverity === 'warning' ? 'bg-amber-500' :
                          'bg-green-500'
                        }`} />
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Legend */}
          <div className="mt-2 pt-2 border-t border-neutral-800 space-y-1">
            <div
              className="text-neutral-600 uppercase tracking-wider"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Severity Thresholds (RPS)
            </div>
            <div className="flex flex-wrap gap-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              <span className="text-neutral-500">idle:0</span>
              <span className="text-cyan-400">normal:&lt;0.5</span>
              <span className="text-green-400">expected:~1</span>
              <span className="text-amber-400">warn:2-5</span>
              <span className="text-red-400">crit:&gt;5</span>
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={resetAllRenderTracking}
            className="w-full mt-2 px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 rounded uppercase tracking-wider transition-colors"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Reset Counters
          </button>
        </div>
      )}
    </div>
  )
}
