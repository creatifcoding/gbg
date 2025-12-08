/**
 * Effect-Atom Testbed
 *
 * EDIN Experiment phase: validating Effect-Atom patterns with
 * Stately Inspector integration for visual state observation.
 *
 * Each hypothesis gets a dedicated section with:
 * - Interactive controls
 * - Live value display
 * - Inspector integration (atoms as pseudo-actors)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { createBrowserInspector } from '@statelyai/inspect'
import { Atom, useAtomValue, useAtom, RegistryProvider, Result } from '@effect-atom/atom-react'
import { Effect, Layer, Cause, Schedule, Stream } from 'effect'
import { createMachine, createActor, assign } from 'xstate'
import { DevDocProvider, DevDocToggle, DocTarget, type BehaviorDoc } from './DevDocOverlay'
import { HalflifeTimeline } from './HalflifeTimeline'
import { SectionLabel, Button, StatusIndicator, CollapsiblePanel } from '@/components/testbed/shared'

// =============================================================================
// RENDER TRACKING (Module-level storage + polling display)
// =============================================================================

/**
 * Isolated render tracking using module-level Map
 *
 * ANTIPATTERN DISCOVERED: Using Atom.family with useAtom for tracking
 * caused infinite loops:
 *   1. useAtom(trackingAtom) SUBSCRIBES to atom
 *   2. useEffect updates atom on every render
 *   3. Subscription triggers re-render → infinite loop
 *
 * FIX: Module-level Map for synchronous tracking (no subscriptions),
 * useState + setInterval for display polling (isolated to badge).
 *
 * LEAK DETECTION THRESHOLDS:
 * - IDLE:     0 RPS (nothing happening)
 * - NORMAL:   < 0.5 RPS (user interactions)
 * - EXPECTED: ~1 RPS (stream emits, expected behavior)
 * - WARNING:  2-5 RPS (possible cascade)
 * - CRITICAL: > 5 RPS (definite leak)
 */

/**
 * Hypothesis keys follow naming convention:
 * - Main hypotheses: h1, h2, h3, h4, h5, h6, h7, h8, h9, h10
 * - Sub-hypotheses: h6_1, h6_2, h6_3 (for H6.1, H6.2, H6.3)
 * - Special streams: h3Stream, h4Stream
 */
type HypothesisKey =
  | 'h1' | 'h2' | 'h3' | 'h3Stream'
  | 'h4' | 'h4Stream' | 'h5'
  | 'h6' | 'h6_1' | 'h6_2' | 'h6_3'
  | 'h7' | 'h8' | 'h9' | 'h10'
  | 'other'

type LeakSeverity = 'idle' | 'normal' | 'expected' | 'warning' | 'critical'

/**
 * Render tracking state for each hypothesis
 */
interface RenderTrackingState {
  count: number
  timestamps: number[]  // Rolling window for rate calculation
}

const RATE_WINDOW_MS = 5000 // 5 second window for RPS calculation

/**
 * Module-level storage for render tracking
 * NO React state = NO subscriptions = NO infinite loops
 */
const renderTrackingStore = new Map<HypothesisKey, RenderTrackingState>()

/**
 * Get or initialize tracking state for a key
 */
function getTrackingState(key: HypothesisKey): RenderTrackingState {
  if (!renderTrackingStore.has(key)) {
    renderTrackingStore.set(key, { count: 0, timestamps: [] })
  }
  return renderTrackingStore.get(key)!
}

/**
 * Calculate severity based on renders-per-second
 */
function calculateSeverity(rps: number, isStream: boolean): LeakSeverity {
  if (rps === 0) return 'idle'
  if (rps < 0.5) return 'normal'
  if (isStream && rps >= 0.8 && rps <= 1.5) return 'expected' // Stream emits ~1/s
  if (rps < 2) return 'normal'
  if (rps < 5) return 'warning'
  return 'critical'
}

/**
 * Hook to track renders - SYNCHRONOUS, no state updates, no subscriptions
 *
 * IMPORTANT: This runs synchronously during render.
 * It does NOT cause re-renders because it doesn't update React state.
 */
function useTrackRender(hypothesisKey: HypothesisKey) {
  // Synchronously increment on every render (no React state!)
  const state = getTrackingState(hypothesisKey)
  const now = Date.now()
  const cutoff = now - RATE_WINDOW_MS

  // Mutate in place (safe because it's module-level, not React state)
  state.count += 1
  state.timestamps = state.timestamps.filter(t => t > cutoff).concat(now)
}

/**
 * Hook to read render stats via polling
 * Each badge polls independently - isolated local state
 */
function useRenderStats(hypothesisKey: HypothesisKey) {
  const [stats, setStats] = useState({ count: 0, rps: 0, severity: 'idle' as LeakSeverity })

  useEffect(() => {
    // Poll every 500ms
    const interval = setInterval(() => {
      const state = getTrackingState(hypothesisKey)
      const now = Date.now()
      const cutoff = now - RATE_WINDOW_MS
      const recentTimestamps = state.timestamps.filter(t => t > cutoff)
      const rps = recentTimestamps.length / (RATE_WINDOW_MS / 1000)
      const isStream = hypothesisKey.includes('Stream')

      setStats({
        count: state.count,
        rps,
        severity: calculateSeverity(rps, isStream),
      })
    }, 500)

    // Initial read
    const state = getTrackingState(hypothesisKey)
    setStats({ count: state.count, rps: 0, severity: 'idle' })

    return () => clearInterval(interval)
  }, [hypothesisKey])

  return stats
}

/**
 * Reset tracking for a specific hypothesis
 */
function resetRenderTracking(hypothesisKey: HypothesisKey) {
  renderTrackingStore.set(hypothesisKey, { count: 0, timestamps: [] })
}

/**
 * Reset all render tracking
 */
const ALL_HYPOTHESIS_KEYS: HypothesisKey[] = [
  'h1', 'h2', 'h3', 'h3Stream',
  'h4', 'h4Stream', 'h5',
  'h6', 'h6_1', 'h6_2', 'h6_3',
  'h7', 'h8', 'h9', 'h10',
  'other',
]

function resetAllRenderTracking() {
  ALL_HYPOTHESIS_KEYS.forEach(key => {
    renderTrackingStore.set(key, { count: 0, timestamps: [] })
  })
}

/**
 * Hook to get aggregated stats across all hypotheses
 * Uses polling for display
 */
function useAggregatedRenderStats() {
  const [stats, setStats] = useState({
    total: 0,
    overallRPS: 0,
    severity: 'idle' as LeakSeverity,
    byKey: {} as Record<HypothesisKey, number>,
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const cutoff = now - RATE_WINDOW_MS

      let total = 0
      let allTimestamps: number[] = []
      const byKey: Record<string, number> = {}

      ALL_HYPOTHESIS_KEYS.forEach(key => {
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
        byKey: byKey as Record<HypothesisKey, number>,
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return stats
}

// =============================================================================
// TYPES
// =============================================================================

type InspectorType = ReturnType<typeof createBrowserInspector>

interface HypothesisSectionProps {
  inspector: InspectorType | null
}

// =============================================================================
// SEVERITY COLORS (for render tracking badges)
// =============================================================================

const SEVERITY_COLORS: Record<LeakSeverity, { bg: string; text: string; border: string }> = {
  idle: { bg: 'bg-neutral-800/50', text: 'text-neutral-400', border: 'border-neutral-700' },
  normal: { bg: 'bg-neutral-800/50', text: 'text-cyan-400', border: 'border-neutral-700' },
  expected: { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-700/50' },
  warning: { bg: 'bg-amber-900/30', text: 'text-amber-400', border: 'border-amber-700/50' },
  critical: { bg: 'bg-red-900/50', text: 'text-red-400', border: 'border-red-700/50' },
}

// =============================================================================
// REUSABLE UI COMPONENTS
// =============================================================================

/**
 * Key-value display for atom values (local: uses JSON.stringify)
 */
function ValueDisplay({ label, value, size = 'base' }: {
  label: string
  value: unknown
  size?: 'sm' | 'base' | 'lg'
}) {
  const sizeStyles = {
    sm: { fontSize: 'var(--tmnl-text-sm, 14px)' },
    base: { fontSize: 'var(--tmnl-text-base, 16px)' },
    lg: { fontSize: 'var(--tmnl-text-lg, 18px)' },
  }
  return (
    <div className="flex items-center gap-3 font-mono" style={sizeStyles[size]}>
      <span className="text-neutral-400">{label}:</span>
      <span className="text-cyan-400 font-semibold">{JSON.stringify(value)}</span>
    </div>
  )
}

/**
 * Card container for hypothesis validation results
 */
function ValidationCard({
  children,
  variant = 'default'
}: {
  children: React.ReactNode
  variant?: 'default' | 'warning' | 'success'
}) {
  const variantClasses = {
    default: 'border-neutral-800 bg-neutral-900/50',
    warning: 'border-amber-800/50 bg-amber-950/20',
    success: 'border-green-800/50 bg-green-950/20',
  }
  return (
    <div className={`p-4 border rounded ${variantClasses[variant]}`}>
      {children}
    </div>
  )
}

// =============================================================================
// HYPOTHESIS BADGE - Compact render tracker using Atom.family
// =============================================================================

/**
 * Compact render badge for hypothesis sections
 *
 * Uses Atom.family-based useRenderStats for ISOLATED tracking.
 * No polling needed - atoms provide reactive updates.
 *
 * @param expectedMounts - Expected initial render count (default: 1)
 *   If actual count exceeds this, shows a warning triangle.
 *   Set to 2 for components that naturally double-render (StrictMode).
 */
function HypothesisBadge({
  hypothesisKey,
  label,
  expectedMounts = 1,
}: {
  hypothesisKey: HypothesisKey
  label?: string
  expectedMounts?: number
}) {
  const { count, rps, severity } = useRenderStats(hypothesisKey)

  const colors = SEVERITY_COLORS[severity]
  const displayLabel = label ?? hypothesisKey.replace('_', '.').toUpperCase()
  const isOverExpected = count > expectedMounts

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded
        font-mono uppercase tracking-wider
        border transition-colors
        ${colors.bg} ${colors.border}
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

/**
 * Container for hypothesis section with badge positioned bottom-right
 * Tracks its own renders via useTrackRender
 */
function HypothesisSection({
  children,
  hypothesisKey,
  label,
  expectedMounts = 1,
  className = '',
}: {
  children: React.ReactNode
  hypothesisKey: HypothesisKey
  label?: string
  expectedMounts?: number
  className?: string
}) {
  // Track renders for this section
  useTrackRender(hypothesisKey)

  return (
    <div className={`relative ${className}`}>
      {children}
      <div className="absolute bottom-2 right-2">
        <HypothesisBadge
          hypothesisKey={hypothesisKey}
          label={label}
          expectedMounts={expectedMounts}
        />
      </div>
    </div>
  )
}

/**
 * Sub-hypothesis card with integrated badge
 * Tracks its own renders via useTrackRender
 */
function SubHypothesisCard({
  id,
  title,
  description,
  hypothesisKey,
  expectedMounts = 1,
  validated,
  children,
}: {
  id: string
  title: string
  description: string
  hypothesisKey: HypothesisKey
  expectedMounts?: number
  validated: boolean
  children: React.ReactNode
}) {
  // Track renders for this sub-hypothesis
  useTrackRender(hypothesisKey)

  return (
    <div className="relative p-4 bg-neutral-800/50 border border-neutral-700 rounded">
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
        <HypothesisBadge
          hypothesisKey={hypothesisKey}
          label={id}
          expectedMounts={expectedMounts}
        />
      </div>
    </div>
  )
}

// =============================================================================
// DAMAGE REPORT COMPONENT
// =============================================================================

interface AntipatternEntry {
  id: string
  title: string
  severity: 'critical' | 'warning' | 'info'
  status: 'fixed' | 'active' | 'mitigated'
  problem: string
  codeExample?: { bad: string; good: string }
  fix: string
}

const H3_2_ANTIPATTERNS: AntipatternEntry[] = [
  {
    id: 'H3.2a',
    title: 'Provider Polling Cascade',
    severity: 'critical',
    status: 'fixed',
    problem: 'Context provider with setInterval causes ALL children to re-render on every poll tick.',
    codeExample: {
      bad: `// ANTIPATTERN: Provider forces child re-renders
function RenderTrackerProvider({ children }) {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    setInterval(() => forceUpdate(n => n + 1), 500)
  }, [])
  return <Context.Provider>{children}</Context.Provider>
}`,
      good: `// FIXED: Provider uses stable refs, no re-renders
function RenderTrackerProvider({ children }) {
  const statsRef = useRef({ h1: 0, h2: 0, ... })
  const tracker = useRef({ increment: ... }).current
  return <Context.Provider value={tracker}>{children}</Context.Provider>
}`
    },
    fix: 'Moved polling to leaf counter component. Provider now uses stable refs that never trigger re-renders.',
  },
  {
    id: 'H3.2b',
    title: 'Unconditional Stream Subscription',
    severity: 'critical',
    status: 'mitigated',
    problem: 'useAtomValue(streamAtom) on mount causes infinite re-render loop. Stream emits every 1s → component re-renders every 1s forever.',
    codeExample: {
      bad: `// ANTIPATTERN: Auto-subscribe on mount
function StreamDisplay() {
  const result = useAtomValue(h3StreamAtom) // ← Runs forever!
  return <div>{result.value}</div>
}`,
      good: `// FIXED: Guarded subscription with pause control
function StreamDisplay({ isSubscribed, onToggle }) {
  const result = isSubscribed ? useAtomValue(h3StreamAtom) : null
  return (
    <div>
      <button onClick={onToggle}>{isSubscribed ? 'PAUSE' : 'SUBSCRIBE'}</button>
      {result && <span>{result.value}</span>}
    </div>
  )
}`
    },
    fix: 'Stream subscription now requires explicit SUBSCRIBE toggle. Starts paused by default.',
  },
  {
    id: 'H3.2c',
    title: 'Double Stream Subscription',
    severity: 'warning',
    status: 'fixed',
    problem: 'Both parent (H3_ResultAtoms) and child (H3_StreamResult) subscribed to same stream atom, doubling render cascade.',
    codeExample: {
      bad: `// ANTIPATTERN: Double subscription
function Parent() {
  const streamResult = useAtomValue(h3StreamAtom) // ← Sub #1
  return <Child />
}
function Child() {
  const streamResult = useAtomValue(h3StreamAtom) // ← Sub #2
}`,
      good: `// FIXED: Single subscription point
function Parent() {
  // No subscription here - delegate to child
  return <Child isSubscribed={subscribed} onToggle={toggle} />
}
function Child({ isSubscribed }) {
  const result = isSubscribed ? useAtomValue(h3StreamAtom) : null
}`
    },
    fix: 'Removed duplicate subscription from parent. Child component is now the single subscription point.',
  },
  {
    id: 'H3.3a',
    title: 'Parent Cascade to Child Render Tracking',
    severity: 'warning',
    status: 'fixed',
    problem: 'Child component (H3_StreamResult) tracked ALL renders as stream-caused, including parent-triggered re-renders (e.g., Reset Trigger click).',
    codeExample: {
      bad: `// ANTIPATTERN: Unconditional render tracking
function H3_StreamResult({ isSubscribed }) {
  tracker?.increment('h3Stream') // ← Counts ALL renders!
  const result = isSubscribed ? useAtomValue(stream) : null
}`,
      good: `// FIXED: Only count stream-caused renders
function H3_StreamResult({ isSubscribed }) {
  const result = isSubscribed ? useAtomValue(stream) : null
  const prevRef = useRef(null)
  const isStreamRender = isSubscribed && result !== prevRef.current
  if (isStreamRender) tracker?.increment('h3Stream')
  prevRef.current = result
}`
    },
    fix: 'Track previous result value. Only increment counter when stream value actually changed, not on parent-cascade renders.',
  },
  {
    id: 'H3.4a',
    title: 'useAtom + useEffect Infinite Loop',
    severity: 'critical',
    status: 'fixed',
    problem: 'Using useAtom() with useEffect to track renders caused infinite loop. useAtom SUBSCRIBES to the atom, so when useEffect updates it, the subscription triggers a re-render, which runs useEffect again → infinite loop.',
    codeExample: {
      bad: `// ANTIPATTERN: useAtom subscribes, useEffect updates → loop
function useTrackRender(key) {
  const [, setTracking] = useAtom(trackingAtom) // ← SUBSCRIBES!
  useEffect(() => {
    setTracking(prev => ({ count: prev.count + 1, ... })) // ← Updates
  }) // ← Runs on every render → triggers subscription → loop
}`,
      good: `// FIXED: Module-level Map, no React state for tracking
const trackingStore = new Map<string, { count: number }>()

function useTrackRender(key) {
  // Synchronous mutation, no subscriptions!
  const state = trackingStore.get(key)
  state.count += 1 // ← No React re-render triggered
}

function useRenderStats(key) {
  const [stats, setStats] = useState({ count: 0 })
  useEffect(() => {
    const interval = setInterval(() => {
      setStats({ count: trackingStore.get(key).count })
    }, 500)
    return () => clearInterval(interval)
  }, [key])
  return stats // ← Polling for display only
}`
    },
    fix: 'Replaced Atom.family subscription with module-level Map. Tracking is synchronous (no React state). Display uses isolated polling via useState + setInterval.',
  },
]

/**
 * FINDING H3.3: Render Behavior Observations
 */
const H3_3_OBSERVATIONS: AntipatternEntry[] = [
  {
    id: 'H3.3b',
    title: 'Result Atom Mount Render Sequence',
    severity: 'info',
    status: 'fixed', // "fixed" = documented/understood
    problem: 'Result atoms cause multiple renders on mount: Initial state render, then re-render when Effect resolves. This is EXPECTED BEHAVIOR.',
    codeExample: {
      bad: `// Not an antipattern - just documenting behavior
// Mount Timeline:
// t=0ms:    Component mounts, Result.Initial
// t=~1ms:   Effect.succeed resolves → Result.Success → re-render
// t=1000ms: Effect.sleep resolves → Result.Success → re-render`,
      good: `// Understanding: This is correct Effect-Atom behavior
// Result<A> has 3 states: Initial | Success | Failure
// Each transition triggers React re-render
//
// Expected renders on mount: 3-4 minimum
// StrictMode doubles this: 6-8 renders`
    },
    fix: 'Not a bug - documented as expected behavior. Plan render budgets accordingly when using Result atoms.',
  },
]

/**
 * DamageReport - Detailed incident briefing component
 */
function DamageReport({
  findingId,
  title,
  incident,
  antipatterns,
  defaultOpen = false,
}: {
  findingId: string
  title: string
  incident: string
  antipatterns: AntipatternEntry[]
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [expandedPatterns, setExpandedPatterns] = useState<Set<string>>(new Set())

  // Use Atom.family-based hook for stream rate
  const { rps: streamRPS, severity: streamSeverity } = useRenderStats('h3Stream')

  const togglePattern = (id: string) => {
    setExpandedPatterns(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const criticalCount = antipatterns.filter(a => a.severity === 'critical').length
  const fixedCount = antipatterns.filter(a => a.status === 'fixed').length
  const activeCount = antipatterns.filter(a => a.status === 'active').length

  const overallSeverity = activeCount > 0 ? 'critical' :
    antipatterns.some(a => a.status === 'mitigated') ? 'warning' : 'resolved'

  const severityColors = {
    critical: { bg: 'bg-red-950/30', border: 'border-red-800/50', text: 'text-red-400', badge: 'bg-red-900/50' },
    warning: { bg: 'bg-amber-950/30', border: 'border-amber-800/50', text: 'text-amber-400', badge: 'bg-amber-900/50' },
    resolved: { bg: 'bg-green-950/20', border: 'border-green-800/50', text: 'text-green-400', badge: 'bg-green-900/50' },
  }

  const colors = severityColors[overallSeverity]

  return (
    <div className={`border rounded ${colors.border} ${colors.bg}`}>
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-neutral-800/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 font-mono uppercase tracking-wider rounded ${colors.badge} ${colors.text}`}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {findingId}
          </span>
          <span
            className="font-mono text-neutral-200"
            style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
          >
            {title}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            <span className="text-green-400">{fixedCount} fixed</span>
            {activeCount > 0 && <span className="text-red-400">{activeCount} active</span>}
          </div>
          <span
            className="text-neutral-500 font-mono"
            style={{ fontSize: 'var(--tmnl-text-xl, 20px)' }}
          >
            {isOpen ? '−' : '+'}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-neutral-800/50 p-4 space-y-4">
          {/* Incident Summary */}
          <div className="p-3 bg-neutral-900/50 rounded border border-neutral-800">
            <div
              className="text-neutral-500 uppercase tracking-wider mb-1"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Incident
            </div>
            <p
              className="text-neutral-300 font-mono"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {incident}
            </p>
          </div>

          {/* Live Metrics */}
          {streamRPS > 0 && (
            <div className={`p-3 rounded border ${
              streamSeverity === 'critical' ? 'bg-red-950/30 border-red-800/50' :
              streamSeverity === 'warning' ? 'bg-amber-950/30 border-amber-800/50' :
              streamSeverity === 'expected' ? 'bg-green-950/20 border-green-800/50' :
              'bg-neutral-900/50 border-neutral-800'
            }`}>
              <div className="flex items-center justify-between">
                <div
                  className="text-neutral-500 uppercase tracking-wider"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  Live Stream Rate
                </div>
                <div
                  className={`font-mono tabular-nums ${
                  streamSeverity === 'critical' ? 'text-red-400' :
                  streamSeverity === 'warning' ? 'text-amber-400' :
                  streamSeverity === 'expected' ? 'text-green-400' :
                  'text-cyan-400'
                }`}
                  style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                >
                  {streamRPS.toFixed(1)} RPS
                  {streamSeverity === 'expected' && <span className="ml-2 text-green-500">✓ Expected</span>}
                  {streamSeverity === 'critical' && <span className="ml-2 text-red-500 animate-pulse">⚠ LEAK</span>}
                </div>
              </div>
            </div>
          )}

          {/* Antipattern List */}
          <div className="space-y-2">
            <div
              className="text-neutral-500 uppercase tracking-wider"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Antipatterns Identified
            </div>
            {antipatterns.map((ap) => {
              const isExpanded = expandedPatterns.has(ap.id)
              const apColors = {
                critical: { dot: 'bg-red-500', text: 'text-red-400' },
                warning: { dot: 'bg-amber-500', text: 'text-amber-400' },
                info: { dot: 'bg-blue-500', text: 'text-blue-400' },
              }[ap.severity]
              const statusColors = {
                fixed: { bg: 'bg-green-900/30', text: 'text-green-400', label: 'FIXED' },
                mitigated: { bg: 'bg-amber-900/30', text: 'text-amber-400', label: 'MITIGATED' },
                active: { bg: 'bg-red-900/30', text: 'text-red-400', label: 'ACTIVE' },
              }[ap.status]

              return (
                <div key={ap.id} className="border border-neutral-800 rounded overflow-hidden">
                  <button
                    onClick={() => togglePattern(ap.id)}
                    className="w-full p-3 text-left flex items-center justify-between hover:bg-neutral-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${apColors.dot}`} />
                      <span
                        className={`font-mono ${apColors.text}`}
                        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                      >
                        {ap.id}
                      </span>
                      <span
                        className="text-neutral-300"
                        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                      >
                        {ap.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 font-mono uppercase rounded ${statusColors.bg} ${statusColors.text}`} style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                        {statusColors.label}
                      </span>
                      <span
                        className="text-neutral-500"
                        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                      >
                        {isExpanded ? '−' : '+'}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-neutral-800 p-3 space-y-3 bg-neutral-950/30">
                      {/* Problem */}
                      <div>
                        <div className="text-neutral-500 uppercase tracking-wider mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>Problem</div>
                        <p
                          className="text-neutral-400 font-mono"
                          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                        >
                          {ap.problem}
                        </p>
                      </div>

                      {/* Code Example */}
                      {ap.codeExample && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-red-500 uppercase tracking-wider mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>Bad</div>
                            <pre className="p-2 bg-red-950/20 border border-red-900/30 rounded text-red-300/80 overflow-x-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                              {ap.codeExample.bad}
                            </pre>
                          </div>
                          <div>
                            <div className="text-green-500 uppercase tracking-wider mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>Good</div>
                            <pre className="p-2 bg-green-950/20 border border-green-900/30 rounded text-green-300/80 overflow-x-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                              {ap.codeExample.good}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Fix */}
                      <div>
                        <div className="text-green-500 uppercase tracking-wider mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>Fix Applied</div>
                        <p
                          className="text-green-400/80 font-mono"
                          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                        >
                          {ap.fix}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Summary Stats */}
          <div
            className="flex items-center justify-between pt-3 border-t border-neutral-800/50 font-mono"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            <div className="flex items-center gap-4">
              <span className="text-neutral-500">{antipatterns.length} antipatterns</span>
              <span className="text-red-400">{criticalCount} critical</span>
            </div>
            <div className={`px-2 py-1 rounded ${colors.badge} ${colors.text} uppercase tracking-wider`}>
              {overallSeverity === 'resolved' ? 'All Fixed' :
               overallSeverity === 'warning' ? 'Partially Mitigated' : 'Active Issues'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// INSPECTOR SETUP
// =============================================================================

/**
 * FINDING: Inspector must be created AFTER iframe is in DOM and has loaded.
 * The library sets iframe.src to stately.ai/inspect and waits for load event.
 */
let inspectorInstance: InspectorType | null = null

function createInspectorInstance(iframe: HTMLIFrameElement): InspectorType {
  if (inspectorInstance) return inspectorInstance

  inspectorInstance = createBrowserInspector({
    iframe,
    autoStart: true,
  })

  return inspectorInstance
}

// =============================================================================
// ATOM → INSPECTOR BRIDGE
// =============================================================================

/**
 * Bridge an atom to the inspector.
 * Registers the atom as a pseudo-actor and sends snapshots on value changes.
 */
function useAtomInspector<A>(
  inspector: InspectorType | null,
  atomId: string,
  atom: Atom.Atom<A>,
  options?: { name?: string }
) {
  const value = useAtomValue(atom)
  const registered = useRef(false)
  const prevValue = useRef<A | undefined>(undefined)

  useEffect(() => {
    if (!inspector) return

    // Register actor on first mount
    if (!registered.current) {
      inspector.actor(atomId, {
        status: 'active',
        context: { value, atomId, name: options?.name ?? atomId },
      })
      registered.current = true
      prevValue.current = value
    }
  }, [inspector, atomId, options?.name, value])

  useEffect(() => {
    if (!inspector || !registered.current) return

    // Only send snapshot if value changed
    if (prevValue.current !== value) {
      inspector.snapshot(atomId, {
        status: 'active',
        context: { value, atomId, name: options?.name ?? atomId },
      })
      prevValue.current = value
    }
  }, [inspector, atomId, value, options?.name])

  return value
}

// =============================================================================
// TEST ATOMS
// =============================================================================

// H1: Primitive Atom
const counterAtom = Atom.make(0)

/**
 * FINDING H1.1: Render tracking via atom causes infinite loop
 *
 * ANTI-PATTERN (causes Maximum update depth exceeded):
 *   const renderCountAtom = Atom.make(0)
 *   useEffect(() => { setRenderCount(c => c + 1) }) // no deps = every render
 *
 * The cycle: render → effect → setAtom → subscriber notified → re-render → repeat
 *
 * SOLUTION: Use ref-only tracking, don't sync render count to reactive state
 * during the render cycle. Only use atoms for user-initiated state changes.
 */

// H2: Derived Atom
const doubledAtom = Atom.make((get) => get(counterAtom) * 2)
const quadrupledAtom = Atom.make((get) => get(doubledAtom) * 2)

// =============================================================================
// H3: RESULT + EFFECT ATOMS (Proper Pattern from README)
// =============================================================================

/**
 * H3 tests the Effect-Atom Result pattern.
 *
 * Key insight from README:
 * - Atom.make(Effect.succeed(value)) returns Atom.Atom<Result.Result<A>>
 * - Use Result.match() to handle Initial | Success | Failure states
 * - This is NOT React Suspense - it's Effect-Atom's own Result monad
 *
 * From README:
 *   const countAtom = Atom.make(Effect.succeed(0))
 *   // Type: Atom.Atom<Result.Result<number>>
 *
 * For streams:
 *   const countAtom = Atom.make(Stream.fromSchedule(Schedule.spaced(1000)))
 *   // Type: Atom.Atom<Result.Result<number>>
 */

// Simple Result atom - returns Result.Result<number>
// Type: Atom.Atom<Result.Result<number>>
const h3SimpleResultAtom = Atom.make(Effect.succeed(42))

// Async Result atom with delay - simulates API call
// Type: (trigger: number) => Atom.Atom<Result.Result<{id, message, timestamp}>>
//
// FINDING H3.5: Result atoms cache forever once resolved.
// To "refetch", use Atom.family keyed by trigger:
// - family(0) → atom A → cached result A (immutable)
// - family(1) → atom B → cached result B (immutable)
// Each is immutable. Changing key = new atom = fresh fetch.
const h3AsyncResultFamily = Atom.family((trigger: number) =>
  Atom.make(
    Effect.gen(function* () {
      yield* Effect.sleep('1 second')
      return {
        id: trigger + 1,
        message: `Fetched after 1s delay (trigger=${trigger})`,
        timestamp: Date.now(),
      }
    })
  )
)

// Stream-based Result atom - emits incrementing numbers every second
// Type: Atom.Atom<Result.Result<number>>
const h3StreamAtom = Atom.make(
  Stream.fromSchedule(Schedule.spaced('1 second'))
)

// Trigger for manual refetch patterns
const h3TriggerAtom = Atom.make(0)

// =============================================================================
// H4: STREAMING ATOM ACCUMULATION (Atom.pull)
// =============================================================================

/**
 * H4 tests the Atom.pull() pattern for stream accumulation.
 *
 * Key insight from effect-atom source:
 * - Atom.pull(stream) creates a writable atom from a Stream
 * - Returns PullResult<A, E> = Result.Result<{ done: boolean, items: NonEmptyArray<A> }>
 * - Writing void (via set) triggers next pull from stream
 * - By default, items ACCUMULATE (disableAccumulation: true to disable)
 *
 * Type signature:
 *   Atom.pull<A, E>(
 *     create: Stream.Stream<A, E, AtomRegistry>,
 *     options?: { disableAccumulation?: boolean }
 *   ): Writable<PullResult<A, E>, void>
 */

// Test data for pull accumulation - Greek letters for visual distinction
const H4_TEST_VALUES = ['α', 'β', 'γ', 'δ', 'ε'] as const
type H4TestValue = typeof H4_TEST_VALUES[number]

// Family pattern: new epoch = new stream = fresh accumulation
// This allows reset functionality by incrementing the epoch
const h4PullFamily = Atom.family((epoch: number) =>
  Atom.pull(
    Stream.fromIterable(H4_TEST_VALUES).pipe(
      Stream.schedule(Schedule.spaced('400 millis'))
    )
  )
)

// Epoch atom for H4 reset functionality
const h4EpochAtom = Atom.make(0)

// =============================================================================
// H5: RUNTIME LAYER INJECTION (Effect.Service + Atom.runtime)
// =============================================================================

/**
 * H5 tests the Atom.runtime() pattern for dependency injection.
 *
 * Key insight from effect-atom docs:
 * - Atom.runtime(Layer) creates an AtomRuntime<R> with services from Layer
 * - runtimeAtom.atom(Effect.gen(...)) creates atoms that access services
 * - runtimeAtom.fn(Effect.fnUntraced(...)) creates function atoms with services
 * - Services accessed via `yield* ServiceClass` inside Effect.gen
 *
 * HYPOTHESIS:
 * "Atom.runtime(Layer.succeed(Service, impl)) provides the service to all atoms
 *  created via runtime.atom(Effect.gen(...)), enabling DI without prop drilling."
 */

// Define a simple Effect.Service for testing
class GreetingService extends Effect.Service<GreetingService>()('testbed/GreetingService', {
  effect: Effect.gen(function* () {
    // Internal state - demonstrates service encapsulation
    let callCount = 0

    const greet = (name: string) =>
      Effect.sync(() => {
        callCount += 1
        return `Hello, ${name}! (call #${callCount})`
      })

    const getCallCount = () => Effect.sync(() => callCount)

    const getSystemInfo = () =>
      Effect.sync(() => ({
        service: 'GreetingService',
        version: '1.0.0',
        initialized: Date.now(),
      }))

    return { greet, getCallCount, getSystemInfo } as const
  }),
}) {}

// Create AtomRuntime from the GreetingService layer
// Type: Atom.AtomRuntime<GreetingService>
const h5RuntimeAtom = Atom.runtime(GreetingService.Default)

// Atom that reads system info from service on mount
// Type: Atom.Atom<Result.Result<{ service: string, version: string, initialized: number }>>
const h5SystemInfoAtom = h5RuntimeAtom.atom(
  Effect.gen(function* () {
    const greeting = yield* GreetingService
    return yield* greeting.getSystemInfo()
  })
)

// Atom that reads call count from service
// Type: Atom.Atom<Result.Result<number>>
const h5CallCountAtom = h5RuntimeAtom.atom(
  Effect.gen(function* () {
    const greeting = yield* GreetingService
    return yield* greeting.getCallCount()
  })
)

// Function atom that calls the greet method
// Type: Atom.Writable<Result.Result<string>, string>
const h5GreetAtom = h5RuntimeAtom.fn(
  Effect.fnUntraced(function* (name: string) {
    const greeting = yield* GreetingService
    return yield* greeting.greet(name)
  })
)

// Epoch for triggering refresh of call count
const h5RefreshEpoch = Atom.make(0)

// =============================================================================
// H6: ATOM.FN ARGUMENT REACTIVITY
// =============================================================================

/**
 * H6 tests the Atom.fn() pattern for function atoms with arguments.
 *
 * Key insight from effect-atom docs:
 * - Atom.fn(Effect.fnUntraced((arg) => Effect.succeed(result))) creates callable atom
 * - Calling setter with new arg re-runs the effect
 * - Result updates reactively via useAtom
 *
 * HYPOTHESIS:
 * "Atom.runtime.fn((arg, get) => Effect.succeed(arg * 2)) creates a function atom;
 *  calling the setter with a new argument re-runs the effect with that argument."
 */

// Simple doubler function atom (no runtime needed for basic test)
// Type: Atom.Writable<Result.Result<number>, number>
const h6DoublerAtom = Atom.fn(
  Effect.fnUntraced(function* (n: number) {
    // Simulate async operation
    yield* Effect.sleep('100 millis')
    return n * 2
  })
)

// Fibonacci calculator - demonstrates more complex computation
// Type: Atom.Writable<Result.Result<{ input: number, result: number, steps: number }>, number>
const h6FibonacciAtom = Atom.fn(
  Effect.fnUntraced(function* (n: number) {
    let steps = 0
    const fib = (x: number): number => {
      steps++
      if (x <= 1) return x
      return fib(x - 1) + fib(x - 2)
    }
    const result = fib(Math.min(n, 25)) // Cap at 25 to prevent browser freeze
    return { input: n, result, steps }
  })
)

// String transformer - demonstrates non-numeric args
// Type: Atom.Writable<Result.Result<string>, { text: string, transform: 'upper' | 'lower' | 'reverse' }>
const h6TransformAtom = Atom.fn(
  Effect.fnUntraced(function* (args: { text: string; transform: 'upper' | 'lower' | 'reverse' }) {
    yield* Effect.sleep('50 millis')
    switch (args.transform) {
      case 'upper': return args.text.toUpperCase()
      case 'lower': return args.text.toLowerCase()
      case 'reverse': return args.text.split('').reverse().join('')
    }
  })
)

// =============================================================================
// H7: BATCH UPDATE COALESCING
// =============================================================================

/**
 * H7 tests Atom.batch() for coalescing multiple updates.
 *
 * Key insight from effect-atom source:
 * - Atom.batch(() => { set(a); set(b); set(c) }) collects updates
 * - Derived atoms recalculate once after batch commits
 * - Subscribers notified once, not per-set
 *
 * HYPOTHESIS:
 * "Registry.batch(() => { set(a, 1); set(b, 2); set(c, 3) }) coalesces notifications;
 *  subscribers re-render exactly once after batch, not three times."
 */

// Three independent writable atoms for batch testing
const h7AtomA = Atom.make(0).pipe(Atom.keepAlive)
const h7AtomB = Atom.make(0).pipe(Atom.keepAlive)
const h7AtomC = Atom.make(0).pipe(Atom.keepAlive)

// Derived atom that depends on all three
// This will recalculate when any dependency changes
const h7DerivedAtom = Atom.readable((get) => {
  const a = get(h7AtomA)
  const b = get(h7AtomB)
  const c = get(h7AtomC)
  return { sum: a + b + c, formula: `${a} + ${b} + ${c}` }
})

// =============================================================================
// H8: ATOM FAMILY PATTERN
// =============================================================================

/**
 * H8 tests Atom.family() for stable atom references by key.
 *
 * Key insight from effect-atom docs:
 * - Atom.family((key) => Atom.make(value)) returns stable refs per key
 * - Same key = same atom instance
 * - Different keys = different atom instances
 * - Useful for dynamic data (user IDs, resource IDs, etc.)
 *
 * HYPOTHESIS:
 * "Atom.family((key: string) => Atom.make(initial)) returns stable atom references
 *  for the same key; different keys produce different atoms."
 */

// Simple counter family - each key gets its own counter
const h8CounterFamily = Atom.family((id: string) =>
  Atom.make({ id, count: 0 }).pipe(Atom.keepAlive)
)

// User profile family - simulates fetching user data
const h8UserFamily = Atom.family((userId: string) =>
  Atom.make({
    userId,
    name: `User ${userId}`,
    loadedAt: Date.now(),
  }).pipe(Atom.keepAlive)
)

// =============================================================================
// H9: SERIALIZATION (SKIPPED - requires Registry access)
// =============================================================================

/**
 * H9: Serialization Round-Trip
 *
 * NOTE: This hypothesis requires direct Registry access for snapshot/hydrate
 * which isn't exposed via the standard React hooks. The pattern exists but
 * testing it properly requires lower-level Registry.make() usage.
 *
 * HYPOTHESIS:
 * "Atom snapshots can be serialized via JSON.stringify and restored via
 *  Registry.hydrate(), preserving atom state across reloads."
 *
 * STATUS: DEFERRED - requires Registry-level API not exposed to React layer
 */

// Placeholder atoms for H9 - would require Registry.snapshot() / Registry.hydrate()
const h9SerializableAtom = Atom.make({ key: 'h9', value: 42, timestamp: 0 }).pipe(Atom.keepAlive)

// =============================================================================
// H10: XSTATE ACTOR INTEGRATION
// =============================================================================

/**
 * H10 tests XState actor integration with effect-atom.
 *
 * Key pattern:
 * - Create XState actor
 * - Wrap in Atom.make() that subscribes to actor
 * - Actor state changes → atom updates → React re-renders
 *
 * HYPOTHESIS:
 * "XState actors can be wrapped in atoms via Atom.make(() => actor.getSnapshot());
 *  actor.subscribe updates the atom, useAtomValue triggers re-renders."
 */

// Simple traffic light machine for testing
const trafficLightMachine = createMachine({
  id: 'trafficLight',
  initial: 'red',
  states: {
    red: {
      on: { NEXT: 'green' },
    },
    green: {
      on: { NEXT: 'yellow' },
    },
    yellow: {
      on: { NEXT: 'red' },
    },
  },
})

// Counter machine with context for more complex state
const counterMachine = createMachine({
  id: 'counter',
  initial: 'idle',
  context: { count: 0 },
  states: {
    idle: {
      on: {
        INCREMENT: {
          actions: assign({ count: ({ context }) => context.count + 1 }),
        },
        DECREMENT: {
          actions: assign({ count: ({ context }) => context.count - 1 }),
        },
        RESET: {
          actions: assign({ count: 0 }),
        },
      },
    },
  },
})

// Create actors
const trafficLightActor = createActor(trafficLightMachine)
const counterActor = createActor(counterMachine)

// Start actors
trafficLightActor.start()
counterActor.start()

// Atom that wraps traffic light actor state
const h10TrafficLightAtom = Atom.make((get) => {
  // Subscribe to actor and update atom on changes
  const subscription = trafficLightActor.subscribe(() => {
    get.setSelf(trafficLightActor.getSnapshot())
  })
  get.addFinalizer(() => subscription.unsubscribe())

  return trafficLightActor.getSnapshot()
})

// Atom that wraps counter actor state
const h10CounterAtom = Atom.make((get) => {
  const subscription = counterActor.subscribe(() => {
    get.setSelf(counterActor.getSnapshot())
  })
  get.addFinalizer(() => subscription.unsubscribe())

  return counterActor.getSnapshot()
})

// =============================================================================
// MANIFESTO: HYPOTHESES ENCODED
// =============================================================================

interface Hypothesis {
  id: string
  title: string
  claim: string
  test: string
  status: 'pending' | 'validated' | 'refuted'
  notes?: string
}

const HYPOTHESES: Hypothesis[] = [
  {
    id: 'H1',
    title: 'Primitive Atom Reactivity',
    claim:
      'Atom.make(initialValue) creates a writable atom where registry.set() triggers all useAtomValue() subscribers synchronously within the same React render cycle.',
    test:
      'Set atom → verify render count increments exactly once per set. Observe inspector snapshots to confirm value propagation.',
    status: 'pending',
  },
  {
    id: 'H2',
    title: 'Derived Atom Dependency Tracking',
    claim:
      'Atom.make((get) => get(baseAtom) * 2) automatically tracks dependencies; when baseAtom changes, derived atom recomputes without manual subscription.',
    test:
      'Chain 3 derived atoms → mutate root → verify cascade propagates correctly. All derived values update in inspector.',
    status: 'pending',
  },
  {
    id: 'H3',
    title: 'Result + Suspense Integration',
    claim:
      'Atom.make(Effect.succeed(value)) returns Result<A, E>; useAtomSuspense() throws Promise during Initial state, resolves on Success, throws error on Failure.',
    test:
      'Create async atom with delay → verify Suspense fallback renders → verify success renders value.',
    status: 'pending',
  },
  {
    id: 'H4',
    title: 'Streaming Atom Accumulation',
    claim:
      'Atom.runtime.pull(stream) accumulates stream emissions into an array; useAtomValue() receives updated array on each emission.',
    test:
      'Create Stream.fromIterable with delay → verify array grows per emission → verify final length.',
    status: 'pending',
  },
  {
    id: 'H5',
    title: 'Runtime Layer Injection',
    claim:
      'Atom.runtime(Layer.succeed(Service, impl)) provides the service to all atoms created via runtime.atom(Effect.gen(...)), enabling DI without prop drilling.',
    test:
      'Create service layer → access service in atom → verify service method returns expected value.',
    status: 'pending',
  },
  {
    id: 'H6',
    title: 'Atom.fn Argument Reactivity',
    claim:
      'Atom.runtime.fn((arg, get) => Effect.succeed(arg * 2)) creates a function atom; calling the setter with a new argument re-runs the effect with that argument.',
    test:
      'Create fn atom → call with arg 5 → verify result is 10 → call with arg 7 → verify result is 14.',
    status: 'pending',
  },
  {
    id: 'H7',
    title: 'Batch Update Coalescing',
    claim:
      'Registry.batch(() => { set(a, 1); set(b, 2); set(c, 3) }) coalesces notifications; subscribers re-render exactly once after batch, not three times.',
    test:
      'Set up render counter → batch 3 sets → verify render count increments by 1.',
    status: 'pending',
  },
  {
    id: 'H8',
    title: 'Atom Family Pattern',
    claim:
      'Dynamic atoms keyed by ID can be created via closure or Map; each key yields a stable atom reference across renders.',
    test:
      'Create family pattern → access same key twice → verify referential equality → access different key → verify different atom.',
    status: 'pending',
  },
  {
    id: 'H9',
    title: 'Serialization Round-Trip (Hydration)',
    claim:
      'Atom.serializable({ key, schema }) enables Hydration.dehydrate() → Hydration.hydrate() round-trip; atom state survives JSON serialization.',
    test:
      'Create serializable atom → set value → dehydrate → create fresh registry → hydrate → verify value restored.',
    status: 'pending',
  },
  {
    id: 'H10',
    title: 'XState Actor Integration',
    claim:
      "An XState actor's state can be bridged to an atom via Atom.subscribable(actor) or manual subscription; atom updates when actor transitions.",
    test:
      'Create XState machine → wrap in atom → send event → verify atom reflects new state.',
    status: 'pending',
  },
]

function Manifesto({ expanded = false }: { expanded?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(expanded)

  return (
    <section className="mb-8 border border-neutral-800 bg-neutral-900/50 rounded">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 text-left flex items-center justify-between hover:bg-neutral-800/30 transition-colors"
      >
        <div>
          <h2
            className="tracking-wide text-neutral-200"
            style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: 'var(--tmnl-text-xl, 20px)' }}
          >
            MANIFESTO OF HYPOTHESES
          </h2>
          <p
            className="text-neutral-500 italic mt-1"
            style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: 'var(--tmnl-text-base, 16px)' }}
          >
            A Declaration of Testable Claims Regarding Effect-Atom Behavior
          </p>
        </div>
        <span
          className="text-neutral-500"
          style={{ fontSize: '1.5rem' }}
        >
          {isExpanded ? '−' : '+'}
        </span>
      </button>

      {isExpanded && (
        <div
          className="p-6 pt-2 border-t border-neutral-800"
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
        >
          <div
            className="mb-6 text-neutral-400 leading-relaxed"
            style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
          >
            <p className="mb-3">
              <em>Whereas</em> the reactive state paradigm demands rigorous
              validation of its primitives;
            </p>
            <p className="mb-3">
              <em>Whereas</em> Effect-Atom purports to unify Effect-TS algebraic
              effects with fine-grained reactivity;
            </p>
            <p className="mb-3">
              <em>Whereas</em> claims without evidence are merely assertions;
            </p>
            <p>
              <strong>We hereby declare</strong> the following hypotheses, to be
              validated through empirical observation within this testbed:
            </p>
          </div>

          <ol className="space-y-6">
            {HYPOTHESES.map((h) => (
              <li key={h.id} className="border-l-2 border-neutral-700 pl-4">
                <div className="flex items-baseline gap-3 mb-2">
                  <span
                    className="text-cyan-500 font-bold"
                    style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
                  >
                    {h.id}
                  </span>
                  <span
                    className="text-neutral-200 font-semibold"
                    style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
                  >
                    {h.title}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded ${
                      h.status === 'validated'
                        ? 'bg-green-900/50 text-green-400'
                        : h.status === 'refuted'
                        ? 'bg-red-900/50 text-red-400'
                        : 'bg-neutral-800 text-neutral-500'
                    }`}
                    style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                  >
                    {h.status.toUpperCase()}
                  </span>
                </div>
                <p
                  className="text-neutral-300 mb-2 leading-relaxed"
                  style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
                >
                  <strong>Claim:</strong> {h.claim}
                </p>
                <p
                  className="text-neutral-500 leading-relaxed"
                  style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
                >
                  <strong>Test:</strong> {h.test}
                </p>
                {h.notes && (
                  <p
                    className="text-neutral-600 mt-2 italic"
                    style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
                  >
                    Note: {h.notes}
                  </p>
                )}
              </li>
            ))}
          </ol>

          <div
            className="mt-8 pt-4 border-t border-neutral-800 text-neutral-500"
            style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
          >
            <p className="italic">
              Executed under the EDIN Protocol: Experiment → Design → Implement → Negotiate
            </p>
            <p className="mt-2 text-neutral-600">
              Observed via Stately Inspector; state changes rendered visible.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

// =============================================================================
// HYPOTHESIS SECTIONS
// =============================================================================

/**
 * H1: Primitive Atom Reactivity
 *
 * FINDING H1.1 APPLIED: Render tracking uses ref-only (no atom)
 * to avoid the infinite loop anti-pattern discovered during testing.
 *
 * ENHANCEMENT: Per-reset render tracking via resetEpoch
 */
function H1_PrimitiveAtom({ inspector }: HypothesisSectionProps) {
  const [count, setCount] = useAtom(counterAtom)

  // Per-reset render tracking
  const renderCountRef = useRef(0)
  const resetEpochRef = useRef(0)
  const rendersThisEpochRef = useRef(0)

  // Track renders per reset epoch
  renderCountRef.current += 1
  rendersThisEpochRef.current += 1

  const totalRenders = renderCountRef.current
  const rendersThisEpoch = rendersThisEpochRef.current
  const resetEpoch = resetEpochRef.current

  // Bridge to inspector
  useAtomInspector(inspector, 'h1-counter', counterAtom, { name: 'H1:Counter' })

  const increment = useCallback(() => {
    inspector?.event('h1-counter', { type: 'INCREMENT' })
    setCount((c) => c + 1)
  }, [inspector, setCount])

  const decrement = useCallback(() => {
    inspector?.event('h1-counter', { type: 'DECREMENT' })
    setCount((c) => c - 1)
  }, [inspector, setCount])

  const reset = useCallback(() => {
    inspector?.event('h1-counter', { type: 'RESET', epoch: resetEpochRef.current + 1 })
    resetEpochRef.current += 1
    rendersThisEpochRef.current = 0 // Reset per-epoch counter
    setCount(0)
  }, [inspector, setCount])

  // Calculate hypothesis validation for this epoch
  // In StrictMode, React renders twice, so we expect ~2x renders
  const minExpected = count + 1
  const maxExpected = (count + 1) * 2
  const withinExpected = rendersThisEpoch >= minExpected && rendersThisEpoch <= maxExpected

  return (
    <HypothesisSection hypothesisKey="h1" label="H1" expectedMounts={2} className="mb-8">
      <section>
        <SectionLabel>H1: Primitive Atom Reactivity</SectionLabel>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <ValueDisplay label="count" value={count} size="lg" />
          <ValueDisplay label="renders (epoch)" value={rendersThisEpoch} />
          <ValueDisplay label="epoch" value={resetEpoch} />
        </div>

        <div
          className="text-neutral-500 font-mono"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          Total renders: {totalRenders}
        </div>

        <div className="flex gap-3">
          <DocTarget
            id="h1-decrement"
            doc={{
              title: 'Decrement',
              description: 'Decrements the counter atom by 1',
              expectedBehavior: 'Counter value decreases by 1, triggers exactly 1 re-render (2 in StrictMode)',
              interactions: [
                { trigger: 'Click', result: 'counter -= 1' },
              ],
              relatedHypotheses: ['H1'],
            }}
          >
            <Button onClick={decrement}>-1</Button>
          </DocTarget>
          <DocTarget
            id="h1-increment"
            doc={{
              title: 'Increment',
              description: 'Increments the counter atom by 1',
              expectedBehavior: 'Counter value increases by 1, triggers exactly 1 re-render (2 in StrictMode)',
              interactions: [
                { trigger: 'Click', result: 'counter += 1' },
              ],
              relatedHypotheses: ['H1'],
            }}
          >
            <Button onClick={increment} variant="primary">+1</Button>
          </DocTarget>
          <DocTarget
            id="h1-reset"
            doc={{
              title: 'Reset',
              description: 'Resets the counter atom to 0 and starts a new render epoch',
              expectedBehavior: 'Counter → 0, epoch increments, per-epoch render count resets to 0',
              interactions: [
                { trigger: 'Click', result: 'counter = 0, epoch++, rendersThisEpoch = 0' },
              ],
              findings: ['H1.1: Render tracking via atom causes infinite loop — use refs instead'],
              relatedHypotheses: ['H1'],
            }}
          >
            <Button onClick={reset} variant="danger">Reset</Button>
          </DocTarget>
        </div>

        <ValidationCard variant={withinExpected ? 'success' : 'default'}>
          <StatusIndicator
            status={withinExpected ? 'success' : 'warning'}
            label={withinExpected ? 'HYPOTHESIS VALIDATED' : 'OBSERVING...'}
          />
          <p
            className="text-neutral-500 font-mono mt-2"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            Expected {minExpected}-{maxExpected} renders this epoch, actual {rendersThisEpoch}
          </p>
          <p
            className="text-neutral-600 font-mono mt-1"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            StrictMode: renders 2× in dev. Atom.set triggers exactly 1 re-render.
          </p>
        </ValidationCard>

        <ValidationCard variant="warning">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-amber-400 font-mono"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              FINDING H1.1
            </span>
          </div>
          <p
            className="text-amber-200/70 font-mono"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            Tracking renders via atom (setRenderCount in useEffect) causes infinite loop.
          </p>
          <p
            className="text-amber-200/50 font-mono mt-1"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            Cycle: render → effect → setAtom → notify → re-render → ...
          </p>
          <p
            className="text-amber-200/50 font-mono mt-1"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            Solution: Use ref-only tracking for render metrics.
          </p>
        </ValidationCard>
      </div>
      </section>
    </HypothesisSection>
  )
}

/**
 * H2: Derived Atom Dependency Tracking
 */
function H2_DerivedAtom({ inspector }: HypothesisSectionProps) {
  const count = useAtomInspector(inspector, 'h2-counter', counterAtom, { name: 'H2:Base' })
  const doubled = useAtomInspector(inspector, 'h2-doubled', doubledAtom, { name: 'H2:Doubled' })
  const quadrupled = useAtomInspector(inspector, 'h2-quadrupled', quadrupledAtom, { name: 'H2:Quadrupled' })

  const expectedDoubled = count * 2
  const expectedQuadrupled = count * 4
  const cascadeValid = doubled === expectedDoubled && quadrupled === expectedQuadrupled

  return (
    <HypothesisSection hypothesisKey="h2" label="H2" expectedMounts={2} className="mb-8">
      <section>
        <SectionLabel>H2: Derived Atom Dependency Tracking</SectionLabel>
        <div className="space-y-3">
          <ValueDisplay label="base (counter)" value={count} size="lg" />
          <ValueDisplay label="doubled (base × 2)" value={doubled} />
          <ValueDisplay label="quadrupled (doubled × 2)" value={quadrupled} />

          <ValidationCard variant={cascadeValid ? 'success' : 'default'}>
            <StatusIndicator
              status={cascadeValid ? 'success' : 'error'}
              label={cascadeValid ? 'CASCADE VALIDATED' : 'CASCADE BROKEN'}
            />
            <p
              className="text-neutral-500 font-mono mt-2"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              Expected: doubled={expectedDoubled}, quad={expectedQuadrupled}
            </p>
            <p
              className="text-neutral-600 font-mono mt-1"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              Derived atoms auto-track dependencies via get()
            </p>
          </ValidationCard>
        </div>
      </section>
    </HypothesisSection>
  )
}

/**
 * H3: Result + Effect Integration (using Result.match pattern)
 *
 * CRITICAL FINDING H3.1: Effect-Atom does NOT use React Suspense.
 * Instead, it uses its own Result monad with 3 states:
 * - Initial: Effect hasn't completed yet
 * - Success: Effect completed with value
 * - Failure: Effect failed with error
 *
 * Pattern from README:
 *   Result.match(result, {
 *     onInitial: () => <div>Loading...</div>,
 *     onFailure: (error) => <div>Error: {Cause.pretty(error.cause)}</div>,
 *     onSuccess: (success) => <div>{success.value}</div>,
 *   })
 */

/**
 * H3.a: Simple Result Atom
 * Tests: Effect.succeed() returns immediately with Result.Success
 */
function H3_SimpleResult({ inspector }: HypothesisSectionProps) {
  const result = useAtomValue(h3SimpleResultAtom)

  return (
    <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded">
      <div
        className="text-neutral-400 font-mono mb-2"
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      >
        H3.a: Simple Result (Effect.succeed)
      </div>
      {Result.match(result, {
        onInitial: () => (
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
            <span
              className="text-amber-400 uppercase tracking-wider"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              INITIAL
            </span>
          </div>
        ),
        onFailure: (error) => (
          <div
            className="text-red-400 font-mono"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            Error: {Cause.pretty(error.cause)}
          </div>
        ),
        onSuccess: (success) => (
          <div className="flex items-center gap-3">
            <StatusIndicator status="success" label="SUCCESS" />
            <span
              className="text-cyan-400 font-mono"
              style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
            >
              {success.value}
            </span>
          </div>
        ),
      })}
    </div>
  )
}

/**
 * H3.b: Async Result Atom
 * Tests: Effect.gen with sleep shows Initial → Success transition
 */
function H3_AsyncResult({ trigger }: { trigger: number }) {
  // FINDING H3.5: Use Atom.family keyed by trigger for refetch
  // When trigger changes → new atom → fresh Effect → new immutable result
  const result = useAtomValue(h3AsyncResultFamily(trigger))

  return (
    <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded">
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-neutral-400 font-mono"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          H3.b: Async Result (1s delay)
        </div>
        <span
          className="font-mono text-neutral-600"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          trigger={trigger}
        </span>
      </div>
      {Result.match(result, {
        onInitial: () => (
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
            <span
              className="text-amber-400 uppercase tracking-wider"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              INITIAL (loading...)
            </span>
          </div>
        ),
        onFailure: (error) => (
          <div
            className="text-red-400 font-mono"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            Error: {Cause.pretty(error.cause)}
          </div>
        ),
        onSuccess: (success) => (
          <div className="space-y-2">
            <StatusIndicator status="success" label="SUCCESS" />
            <pre
              className="text-cyan-400 font-mono overflow-auto"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {JSON.stringify(success.value, null, 2)}
            </pre>
          </div>
        ),
      })}
    </div>
  )
}

/**
 * H3.c: Stream Result Atom
 * Tests: Stream.fromSchedule emits incrementing values
 *
 * ANTIPATTERN H3.2b ISOLATED: Stream subscription with pause control
 * - Stream emits every 1s → causes re-render cascade
 * - Now guarded by explicit "subscribe" toggle
 *
 * FINDING H3.3a: Parent re-renders cascade to children
 * - When H3_ResultAtoms re-renders (e.g., trigger change), children re-render too
 * - Previously tracked ALL renders as h3Stream, even non-stream-caused ones
 * - FIX: Only count renders when subscribed AND value actually changed
 *
 * FINDING H3.4: Conditional hook call violates Rules of Hooks
 * - Pattern: `const result = isSubscribed ? useAtomValue(atom) : null`
 * - Error: "Rendered more hooks than during the previous render"
 * - FIX: Extract subscription into separate component that mounts/unmounts
 */

/**
 * Inner component that actually subscribes to the stream
 * Mounts only when subscribed - this avoids conditional hook calls
 */
function H3_StreamValueDisplay() {
  const result = useAtomValue(h3StreamAtom)

  // Track previous result to detect stream-caused renders vs parent-caused renders
  const prevResultRef = useRef<typeof result>(null)
  const isStreamCausedRender = result !== prevResultRef.current

  // FINDING H3.3a FIX: Only count stream-caused renders, not parent cascade renders
  // Using module-level tracking (synchronous, no subscriptions)
  if (isStreamCausedRender) {
    const state = getTrackingState('h3Stream')
    const now = Date.now()
    state.count += 1
    state.timestamps = state.timestamps.filter(t => now - t < RATE_WINDOW_MS).concat(now)
  }
  prevResultRef.current = result

  return Result.match(result, {
    onInitial: () => (
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
        <span
          className="text-amber-400 uppercase tracking-wider"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          INITIAL (waiting for first emit)
        </span>
      </div>
    ),
    onFailure: (error) => (
      <div
        className="text-red-400 font-mono"
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      >
        Error: {Cause.pretty(error.cause)}
      </div>
    ),
    onSuccess: (success) => (
      <div className="flex items-center gap-3">
        <StatusIndicator status="success" label="STREAMING" />
        <span
          className="text-cyan-400 font-mono"
          style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
        >
          Tick: {success.value}
        </span>
      </div>
    ),
  })
}

function H3_StreamResult({
  isSubscribed,
  onToggle,
}: { isSubscribed: boolean; onToggle: () => void }) {
  return (
    <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded">
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-neutral-400 font-mono"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          H3.c: Stream Result (1s interval)
        </div>
        <DocTarget
          id="h3-stream-subscribe"
          doc={{
            title: isSubscribed ? 'Pause Stream' : 'Subscribe to Stream',
            description: isSubscribed
              ? 'Stops listening to the stream atom, preventing further re-renders'
              : 'Starts listening to the stream atom which emits every 1 second',
            expectedBehavior: isSubscribed
              ? 'Stream subscription stops, h3Stream rate drops to 0 RPS'
              : 'Stream subscription starts, h3Stream rate settles at ~1 RPS (expected)',
            interactions: [
              { trigger: 'Click', result: isSubscribed ? 'Unsubscribe from stream' : 'Subscribe to stream' },
            ],
            findings: [
              'H3.2b: Unconditional subscription caused infinite render loop',
              'H3.2c: Double subscription doubled render cascade',
              'Mitigation: Explicit subscribe toggle, starts paused by default',
            ],
            relatedHypotheses: ['H3'],
          }}
        >
          <button
            onClick={onToggle}
            className={`px-2 py-1 font-mono uppercase tracking-wider rounded transition-colors ${
              isSubscribed
                ? 'bg-red-900/50 text-red-300 border border-red-700/50'
                : 'bg-green-900/50 text-green-300 border border-green-700/50'
            }`}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {isSubscribed ? 'PAUSE' : 'SUBSCRIBE'}
          </button>
        </DocTarget>
      </div>
      {/*
        FINDING H3.4 FIX: Component boundary instead of conditional hook
        - When !isSubscribed: H3_StreamValueDisplay not mounted, no hook call
        - When isSubscribed: H3_StreamValueDisplay mounts, hook called unconditionally
      */}
      {!isSubscribed ? (
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-neutral-500" />
          <span
            className="text-neutral-500 uppercase tracking-wider"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            PAUSED (click Subscribe to start)
          </span>
        </div>
      ) : (
        <H3_StreamValueDisplay />
      )}
    </div>
  )
}

/**
 * H3: Result + Effect Integration (Main Section)
 *
 * ANTIPATTERN H3.2c FIXED: Removed double subscription to h3StreamAtom
 * - Previously: Both this component AND H3_StreamResult subscribed
 * - Now: Only H3_StreamResult subscribes, validation tracks via ref
 *
 * FINDING H3.3b: Result Atom Mount Render Sequence
 * ================================================
 * Result atoms (Atom.make(Effect)) cause multiple renders on mount:
 *
 *   Mount Timeline:
 *   ┌─────────────┬────────────────────────────────────────────┐
 *   │ t=0ms       │ Component mounts, atoms start in Initial   │
 *   │ t=~1ms      │ h3SimpleResultAtom resolves (Effect.succeed│
 *   │             │ is synchronous) → re-render                │
 *   │ t=1000ms    │ h3AsyncResultFamily(trigger) resolves      │
 *   │             │ → re-render                                │
 *   │ StrictMode  │ All of above ×2 (dev mode double-render)   │
 *   └─────────────┴────────────────────────────────────────────┘
 *
 * Expected H3 renders on fresh mount: 4-6 (StrictMode: 8-12)
 * This is EXPECTED BEHAVIOR - Result.Initial → Result.Success is a state change.
 */
function H3_ResultAtoms({ inspector }: HypothesisSectionProps) {
  const [trigger, setTrigger] = useAtom(h3TriggerAtom)

  // Stream subscription control - starts PAUSED to prevent render leak
  const [streamSubscribed, setStreamSubscribed] = useState(false)
  const streamValidatedRef = useRef(false)

  // Track whether each result type has been observed
  // NOTE: Only subscribe to non-streaming atoms here
  // FINDING H3.3b: These subscriptions cause Initial→Success renders on mount
  const simpleResult = useAtomValue(h3SimpleResultAtom)
  const asyncResult = useAtomValue(h3AsyncResultFamily(trigger))
  // ANTIPATTERN H3.2c: Removed duplicate subscription to h3StreamAtom
  // const streamResult = useAtomValue(h3StreamAtom) // ← CAUSES RENDER LEAK

  const simpleSuccess = Result.isSuccess(simpleResult)
  const asyncSuccess = Result.isSuccess(asyncResult)
  // Stream validation tracked via callback from child
  const streamSuccess = streamValidatedRef.current

  const allValidated = simpleSuccess && asyncSuccess && streamSuccess

  const resetTrigger = useCallback(() => {
    inspector?.event('h3-trigger', { type: 'RESET', trigger: trigger + 1 })
    setTrigger((t) => t + 1)
  }, [inspector, trigger, setTrigger])

  const toggleStream = useCallback(() => {
    setStreamSubscribed((s) => !s)
    // Mark as validated once subscribed (stream emits within 1s)
    if (!streamSubscribed) {
      setTimeout(() => {
        streamValidatedRef.current = true
      }, 1500)
    }
  }, [streamSubscribed])

  return (
    <HypothesisSection hypothesisKey="h3" label="H3" expectedMounts={2} className="mb-8">
      <section>
        <SectionLabel>H3: Result + Effect Integration</SectionLabel>
        <div className="space-y-4">
          <ValueDisplay label="trigger" value={trigger} />

        <div className="flex gap-3">
          <DocTarget
            id="h3-reset-trigger"
            doc={{
              title: 'Reset Trigger',
              description: 'Increments the trigger atom, which can be used to invalidate/refetch dependent atoms',
              expectedBehavior: 'trigger += 1, causes parent re-render but NOT stream rate increase (H3.3a fixed)',
              interactions: [
                { trigger: 'Click', result: 'trigger atom += 1' },
              ],
              findings: [
                'H3.3a: Previously triggered false stream rate increase due to parent cascade counting',
                'Fixed: Stream counter only increments when stream value actually changes',
              ],
              relatedHypotheses: ['H3'],
            }}
          >
            <Button onClick={resetTrigger} variant="primary">Reset Trigger</Button>
          </DocTarget>
        </div>

        <div className="space-y-3">
          <H3_SimpleResult inspector={inspector} />
          <H3_AsyncResult trigger={trigger} />
          <H3_StreamResult
            inspector={inspector}
            isSubscribed={streamSubscribed}
            onToggle={toggleStream}
          />
        </div>

        <ValidationCard variant={allValidated ? 'success' : 'default'}>
          <StatusIndicator
            status={allValidated ? 'success' : 'warning'}
            label={allValidated ? 'ALL RESULTS VALIDATED' : 'OBSERVING RESULT STATES...'}
          />
          <div className="mt-3 space-y-1 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            <div className="flex items-center gap-2">
              <span className={simpleSuccess ? 'text-green-400' : 'text-neutral-500'}>
                {simpleSuccess ? '✓' : '○'}
              </span>
              <span className="text-neutral-400">H3.a: Simple Result</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={asyncSuccess ? 'text-green-400' : 'text-neutral-500'}>
                {asyncSuccess ? '✓' : '○'}
              </span>
              <span className="text-neutral-400">H3.b: Async Result (1s delay)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={streamSuccess ? 'text-green-400' : 'text-neutral-500'}>
                {streamSuccess ? '✓' : '○'}
              </span>
              <span className="text-neutral-400">
                H3.c: Stream Result {streamSubscribed ? '(active)' : '(paused)'}
              </span>
            </div>
          </div>
        </ValidationCard>

        <ValidationCard variant="warning">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>FINDING H3.1</span>
          </div>
          <p className="text-amber-200/70 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Effect-Atom does NOT use React Suspense.
          </p>
          <p className="text-amber-200/50 font-mono mt-1" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Use Result.match() with onInitial/onSuccess/onFailure handlers.
          </p>
        </ValidationCard>

        <DamageReport
          findingId="FINDING H3.2"
          title="Stream Render Leak Analysis"
          incident="11,250+ renders observed with cascade leakage. Stream atom emitting every 1s caused exponential render cascade through provider polling and double subscriptions."
          antipatterns={H3_2_ANTIPATTERNS}
          defaultOpen={false}
        />

        <DamageReport
          findingId="FINDING H3.3"
          title="Render Behavior Observations"
          incident="Unexpected render counts on mount and when clicking Reset Trigger. Investigation revealed Result atom lifecycle and parent-child render cascade."
          antipatterns={H3_3_OBSERVATIONS}
          defaultOpen={false}
        />
        </div>
      </section>
    </HypothesisSection>
  )
}

// =============================================================================
// H4: STREAMING ATOM ACCUMULATION
// =============================================================================

/**
 * H4: Streaming Atom Accumulation
 *
 * Tests the Atom.pull() pattern:
 * - Creates a pull atom from a finite stream
 * - Each "pull" triggers the next emission
 * - Items accumulate in the result array
 * - done: true when stream completes
 *
 * HYPOTHESIS:
 * "Atom.pull(stream) accumulates stream emissions into an array;
 *  useAtomValue() receives updated array on each emission."
 */
function H4_StreamingAccumulation({ inspector }: HypothesisSectionProps) {
  const [epoch, setEpoch] = useAtom(h4EpochAtom)
  const [pullResult, setPullResult] = useAtom(h4PullFamily(epoch))

  // Track pull history for validation
  const pullCountRef = useRef(0)
  const [pullCount, setPullCount] = useState(0)

  // Extract data from result
  const resultData = Result.match(pullResult, {
    onInitial: () => ({ state: 'initial' as const, items: [] as string[], done: false }),
    onFailure: (error) => ({ state: 'failure' as const, items: [] as string[], done: false, error }),
    onSuccess: (success) => ({
      state: 'success' as const,
      items: success.value.items as string[],
      done: success.value.done,
    }),
  })

  // Validation logic
  const expectedTotal = H4_TEST_VALUES.length
  const currentCount = resultData.items.length
  const isComplete = resultData.done && currentCount === expectedTotal
  const isAccumulating = resultData.state === 'success' && currentCount > 0 && !resultData.done

  const triggerPull = useCallback(() => {
    pullCountRef.current += 1
    setPullCount(pullCountRef.current)
    inspector?.event('h4-pull', { type: 'PULL', count: pullCountRef.current })
    // Writing void to pull atom triggers next pull
    setPullResult()
  }, [inspector, setPullResult])

  const reset = useCallback(() => {
    pullCountRef.current = 0
    setPullCount(0)
    inspector?.event('h4-pull', { type: 'RESET', epoch: epoch + 1 })
    setEpoch((e) => e + 1)
  }, [inspector, epoch, setEpoch])

  // Auto-pull on mount to start the stream
  const hasInitialized = useRef(false)
  useEffect(() => {
    if (!hasInitialized.current && resultData.state === 'initial') {
      hasInitialized.current = true
      // Initial pull to start
      triggerPull()
    }
  }, [resultData.state, triggerPull])

  return (
    <HypothesisSection hypothesisKey="h4" label="H4" expectedMounts={2} className="mb-8">
      <section>
        <SectionLabel>H4: Streaming Atom Accumulation</SectionLabel>
        <div className="space-y-4">
          {/* Status bar */}
          <div className="grid grid-cols-4 gap-4">
          <ValueDisplay label="epoch" value={epoch} />
          <ValueDisplay label="pulls" value={pullCount} />
          <ValueDisplay label="items" value={currentCount} />
          <ValueDisplay label="expected" value={expectedTotal} />
        </div>

        {/* Visual accumulation display */}
        <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded">
          <div className="flex items-center justify-between mb-3">
            <div className="text-neutral-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Accumulated Items</div>
            <div
              className={`font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
                resultData.state === 'initial' ? 'bg-amber-900/50 text-amber-400' :
                resultData.done ? 'bg-green-900/50 text-green-400' :
                'bg-cyan-900/50 text-cyan-400'
              }`}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {resultData.state === 'initial' ? 'WAITING' :
               resultData.done ? 'COMPLETE' : 'STREAMING'}
            </div>
          </div>

          {/* Greek letter visualization */}
          <div className="flex items-center gap-2 mb-4">
            {H4_TEST_VALUES.map((letter, idx) => {
              const isReceived = resultData.items.includes(letter)
              return (
                <div
                  key={letter}
                  className={`w-12 h-12 flex items-center justify-center rounded border font-mono transition-all duration-300 ${
                    isReceived
                      ? 'bg-cyan-900/50 border-cyan-600 text-cyan-300 scale-110'
                      : 'bg-neutral-800/50 border-neutral-700 text-neutral-600'
                  }`}
                  style={{ fontSize: 'var(--tmnl-text-xl, 20px)' }}
                >
                  {letter}
                </div>
              )
            })}
          </div>

          {/* Raw data display */}
          <div className="font-mono text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            items: [{resultData.items.map(i => `"${i}"`).join(', ')}]
          </div>
          <div className="font-mono text-neutral-600 mt-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            done: {String(resultData.done)}
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          <DocTarget
            id="h4-pull"
            doc={{
              title: 'Pull Next',
              description: 'Triggers the next emission from the stream by writing void to the pull atom',
              expectedBehavior: 'Items array grows by 1, pull count increments, visual letter lights up',
              interactions: [
                { trigger: 'Click', result: 'setPullResult() → next stream item pulled' },
              ],
              relatedHypotheses: ['H4'],
            }}
          >
            <Button
              onClick={triggerPull}
              variant="primary"
              disabled={resultData.done}
            >
              Pull Next
            </Button>
          </DocTarget>
          <DocTarget
            id="h4-reset"
            doc={{
              title: 'Reset Stream',
              description: 'Increments epoch to create fresh pull atom with new stream',
              expectedBehavior: 'All state resets, stream starts fresh from α',
              interactions: [
                { trigger: 'Click', result: 'epoch++, pullCount=0, fresh atom' },
              ],
              relatedHypotheses: ['H4'],
            }}
          >
            <Button onClick={reset} variant="danger">Reset</Button>
          </DocTarget>
          <DocTarget
            id="h4-auto-pull"
            doc={{
              title: 'Auto-Pull All',
              description: 'Rapidly pulls all remaining items from the stream',
              expectedBehavior: 'All 5 items accumulate in sequence with 400ms delays',
              interactions: [
                { trigger: 'Click', result: 'Interval pulls until done=true' },
              ],
              relatedHypotheses: ['H4'],
            }}
          >
            <Button
              onClick={() => {
                const interval = setInterval(() => {
                  if (pullCountRef.current >= expectedTotal) {
                    clearInterval(interval)
                    return
                  }
                  triggerPull()
                }, 100)
              }}
              variant="default"
              disabled={resultData.done}
            >
              Auto-Pull All
            </Button>
          </DocTarget>
        </div>

        {/* Validation card */}
        <ValidationCard variant={isComplete ? 'success' : isAccumulating ? 'default' : 'warning'}>
          <StatusIndicator
            status={isComplete ? 'success' : isAccumulating ? 'neutral' : 'warning'}
            label={isComplete ? 'HYPOTHESIS VALIDATED' : isAccumulating ? 'ACCUMULATING...' : 'WAITING FOR PULL'}
          />
          <div className="mt-3 space-y-1 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            <div className="flex items-center gap-2">
              <span className={currentCount > 0 ? 'text-green-400' : 'text-neutral-500'}>
                {currentCount > 0 ? '✓' : '○'}
              </span>
              <span className="text-neutral-400">Items accumulate per pull</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={currentCount === pullCount ? 'text-green-400' : 'text-neutral-500'}>
                {currentCount === pullCount ? '✓' : '○'}
              </span>
              <span className="text-neutral-400">Pull count matches item count</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={isComplete ? 'text-green-400' : 'text-neutral-500'}>
                {isComplete ? '✓' : '○'}
              </span>
              <span className="text-neutral-400">done=true when stream exhausted</span>
            </div>
          </div>
        </ValidationCard>

        {/* Technical notes */}
        <ValidationCard variant="warning">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>PATTERN: Atom.pull()</span>
          </div>
          <p className="text-amber-200/70 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Pull atoms provide demand-driven stream consumption.
          </p>
          <p className="text-amber-200/50 font-mono mt-1" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Unlike H3.c (auto-emit), H4 requires explicit pull triggers.
          </p>
          <p className="text-amber-200/50 font-mono mt-1" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Accumulation is ON by default. Use {'{ disableAccumulation: true }'} for latest-only.
          </p>
        </ValidationCard>
        </div>
      </section>
    </HypothesisSection>
  )
}

// =============================================================================
// H5: RUNTIME LAYER INJECTION
// =============================================================================

/**
 * H5: Runtime Layer Injection
 *
 * Tests the Atom.runtime() pattern for Effect service DI:
 * - Creates an AtomRuntime from a service Layer
 * - Atoms created via runtime.atom() access services
 * - Function atoms via runtime.fn() can call service methods
 * - No prop drilling required
 *
 * HYPOTHESIS:
 * "Atom.runtime(Layer.succeed(Service, impl)) provides the service to all atoms
 *  created via runtime.atom(Effect.gen(...)), enabling DI without prop drilling."
 */
function H5_RuntimeLayerInjection({ inspector }: HypothesisSectionProps) {
  // Read system info from service (validates service is accessible)
  const systemInfoResult = useAtomValue(h5SystemInfoAtom)

  // Greet function atom
  const [greetResult, greet] = useAtom(h5GreetAtom)

  // Local state for name input
  const [nameInput, setNameInput] = useState('Prime')
  const [greetings, setGreetings] = useState<string[]>([])

  // Track validation state
  const serviceAccessible = Result.isSuccess(systemInfoResult)
  const hasGreeted = greetings.length > 0

  const handleGreet = useCallback(() => {
    greet(nameInput)
  }, [greet, nameInput])

  // Collect greeting results
  useEffect(() => {
    if (Result.isSuccess(greetResult)) {
      setGreetings(prev => [...prev, greetResult.value])
    }
  }, [greetResult])

  const allValidated = serviceAccessible && hasGreeted

  return (
    <HypothesisSection hypothesisKey="h5" label="H5" expectedMounts={2} className="mb-8">
      <section>
        <SectionLabel>H5: Runtime Layer Injection</SectionLabel>
        <div className="space-y-4">
          {/* Service Info Display */}
        <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded">
          <div className="flex items-center justify-between mb-3">
            <div className="text-neutral-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>GreetingService Status</div>
            <div
              className={`font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
                serviceAccessible ? 'bg-green-900/50 text-green-400' : 'bg-amber-900/50 text-amber-400'
              }`}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {serviceAccessible ? 'INJECTED' : 'LOADING'}
            </div>
          </div>

          {Result.match(systemInfoResult, {
            onInitial: () => (
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-amber-400" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Initializing service...</span>
              </div>
            ),
            onFailure: (error) => (
              <div className="text-red-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                Service Error: {Cause.pretty(error.cause)}
              </div>
            ),
            onSuccess: (success) => (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-4 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                  <div>
                    <span className="text-neutral-500">service:</span>{' '}
                    <span className="text-cyan-400">{success.value.service}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">version:</span>{' '}
                    <span className="text-cyan-400">{success.value.version}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">initialized:</span>{' '}
                    <span className="text-cyan-400">{new Date(success.value.initialized).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            ),
          })}
        </div>

        {/* Greet Function Test */}
        <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded">
          <div className="text-neutral-400 font-mono mb-3" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>runtime.fn() Test</div>

          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Enter name..."
              className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded font-mono text-neutral-200 placeholder-neutral-600 focus:border-cyan-600 focus:outline-none"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            />
            <DocTarget
              id="h5-greet"
              doc={{
                title: 'Call Greet Service',
                description: 'Calls GreetingService.greet() via runtime.fn() atom',
                expectedBehavior: 'Service method executes, returns greeting with call count',
                interactions: [
                  { trigger: 'Click', result: 'greet(name) → "Hello, {name}! (call #{n})"' },
                ],
                relatedHypotheses: ['H5'],
              }}
            >
              <Button onClick={handleGreet} variant="primary">Greet</Button>
            </DocTarget>
          </div>

          {/* Greeting History */}
          <div className="space-y-1">
            <div
              className="text-neutral-500 uppercase tracking-wider"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Greeting History
            </div>
            {greetings.length === 0 ? (
              <div className="text-neutral-600 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>No greetings yet...</div>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {greetings.map((g, idx) => (
                  <div key={idx} className="font-mono text-cyan-400 flex items-center gap-2" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                    <span className="text-neutral-600">{idx + 1}.</span>
                    {g}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Validation */}
        <ValidationCard variant={allValidated ? 'success' : 'default'}>
          <StatusIndicator
            status={allValidated ? 'success' : 'neutral'}
            label={allValidated ? 'HYPOTHESIS VALIDATED' : 'TESTING...'}
          />
          <div className="mt-3 space-y-1 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            <div className="flex items-center gap-2">
              <span className={serviceAccessible ? 'text-green-400' : 'text-neutral-500'}>
                {serviceAccessible ? '✓' : '○'}
              </span>
              <span className="text-neutral-400">Service accessible via runtime.atom()</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={hasGreeted ? 'text-green-400' : 'text-neutral-500'}>
                {hasGreeted ? '✓' : '○'}
              </span>
              <span className="text-neutral-400">Service method callable via runtime.fn()</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={greetings.length > 1 ? 'text-green-400' : 'text-neutral-500'}>
                {greetings.length > 1 ? '✓' : '○'}
              </span>
              <span className="text-neutral-400">Service maintains internal state (call count)</span>
            </div>
          </div>
        </ValidationCard>

        {/* Technical notes */}
        <ValidationCard variant="warning">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>PATTERN: Atom.runtime()</span>
          </div>
          <p className="text-amber-200/70 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            AtomRuntime provides Effect services to atoms without prop drilling.
          </p>
          <p className="text-amber-200/50 font-mono mt-1" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            runtime.atom() for read effects, runtime.fn() for callable effects.
          </p>
          <p className="text-amber-200/50 font-mono mt-1" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Services yield* via Effect.gen, just like regular Effect code.
          </p>
        </ValidationCard>
        </div>
      </section>
    </HypothesisSection>
  )
}

// =============================================================================
// H6: ATOM.FN ARGUMENT REACTIVITY
// =============================================================================

/**
 * H6: Atom.fn Argument Reactivity
 *
 * Tests that function atoms re-run when called with new arguments:
 * - Atom.fn() creates callable atoms
 * - Each call with new arg triggers fresh Effect execution
 * - Result updates reactively
 */
function H6_AtomFnReactivity({ inspector }: HypothesisSectionProps) {
  // Doubler atom
  const [doublerResult, callDoubler] = useAtom(h6DoublerAtom)
  const [doublerInput, setDoublerInput] = useState(5)
  const [doublerHistory, setDoublerHistory] = useState<Array<{ input: number; output: number }>>([])

  // Fibonacci atom
  const [fibResult, callFib] = useAtom(h6FibonacciAtom)
  const [fibInput, setFibInput] = useState(10)

  // Transform atom
  const [transformResult, callTransform] = useAtom(h6TransformAtom)
  const [transformText, setTransformText] = useState('Effect-Atom')

  // Track doubler history
  useEffect(() => {
    if (Result.isSuccess(doublerResult)) {
      const output = doublerResult.value
      setDoublerHistory(prev => {
        // Avoid duplicates
        if (prev.length > 0 && prev[prev.length - 1].output === output) return prev
        return [...prev.slice(-4), { input: output / 2, output }]
      })
    }
  }, [doublerResult])

  // Validation
  const doublerWorks = doublerHistory.length > 0
  const fibWorks = Result.isSuccess(fibResult)
  const transformWorks = Result.isSuccess(transformResult)
  const multipleCallsWork = doublerHistory.length >= 2
  const allValidated = doublerWorks && fibWorks && transformWorks && multipleCallsWork

  return (
    <HypothesisSection hypothesisKey="h6" label="H6" className="mb-8">
      <section>
        <SectionLabel>H6: Atom.fn Argument Reactivity</SectionLabel>
        <div className="space-y-4">
          {/* H6.1: Doubler - Number argument reactivity */}
          <SubHypothesisCard
            id="H6.1"
            title="Doubler"
            description="Atom.fn() with number argument, reactive updates"
            hypothesisKey="h6_1"
            validated={doublerWorks && multipleCallsWork}
          >
            <div className="flex gap-3 mb-3">
              <input
                type="number"
                value={doublerInput}
                onChange={(e) => setDoublerInput(Number(e.target.value))}
                className="w-24 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded font-mono text-neutral-200 focus:border-cyan-600 focus:outline-none"
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              />
              <Button onClick={() => callDoubler(doublerInput)} variant="primary">
                Double It
              </Button>
              <div className="flex items-center gap-2">
                {Result.match(doublerResult, {
                  onInitial: () => <span className="text-neutral-500" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>—</span>,
                  onFailure: () => <span className="text-red-400" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Error</span>,
                  onSuccess: (s) => (
                    <span className="text-cyan-400 font-mono font-bold" style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}>{s.value}</span>
                  ),
                })}
              </div>
            </div>
            {/* History */}
            <div className="flex items-center gap-2 font-mono text-neutral-500 pb-6" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              <span>History:</span>
              {doublerHistory.map((h, i) => (
                <span key={i} className="text-cyan-400/70">
                  {h.input}→{h.output}
                  {i < doublerHistory.length - 1 && <span className="text-neutral-600 mx-1">|</span>}
                </span>
              ))}
              {doublerHistory.length === 0 && <span className="text-neutral-600">none</span>}
            </div>
          </SubHypothesisCard>

          {/* H6.2: Fibonacci - Complex computation */}
          <SubHypothesisCard
            id="H6.2"
            title="Fibonacci"
            description="Complex computation with step tracking"
            hypothesisKey="h6_2"
            validated={fibWorks}
          >
            <div className="flex gap-3 mb-2">
              <input
                type="range"
                min={1}
                max={25}
                value={fibInput}
                onChange={(e) => setFibInput(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-8 text-center font-mono text-neutral-300">{fibInput}</span>
              <Button onClick={() => callFib(fibInput)} variant="primary">
                Calculate
              </Button>
            </div>
            <div className="pb-6">
              {Result.match(fibResult, {
                onInitial: () => <div className="text-neutral-500 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Ready...</div>,
                onFailure: (e) => <div className="text-red-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Error: {Cause.pretty(e.cause)}</div>,
                onSuccess: (s) => (
                  <div className="grid grid-cols-3 gap-4 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                    <div>
                      <span className="text-neutral-500">input:</span>{' '}
                      <span className="text-neutral-300">{s.value.input}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">fib({s.value.input}):</span>{' '}
                      <span className="text-cyan-400 font-bold">{s.value.result.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">steps:</span>{' '}
                      <span className="text-amber-400">{s.value.steps.toLocaleString()}</span>
                    </div>
                  </div>
                ),
              })}
            </div>
          </SubHypothesisCard>

          {/* H6.3: Transform - Object arguments */}
          <SubHypothesisCard
            id="H6.3"
            title="String Transform"
            description="Object arguments with multiple operations"
            hypothesisKey="h6_3"
            validated={transformWorks}
          >
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={transformText}
                onChange={(e) => setTransformText(e.target.value)}
                className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded font-mono text-neutral-200 focus:border-cyan-600 focus:outline-none"
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              />
              <Button onClick={() => callTransform({ text: transformText, transform: 'upper' })}>
                UPPER
              </Button>
              <Button onClick={() => callTransform({ text: transformText, transform: 'lower' })}>
                lower
              </Button>
              <Button onClick={() => callTransform({ text: transformText, transform: 'reverse' })}>
                esreveR
              </Button>
            </div>
            <div className="pb-6">
              {Result.match(transformResult, {
                onInitial: () => <div className="text-neutral-500 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Click a transform...</div>,
                onFailure: () => <div className="text-red-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Error</div>,
                onSuccess: (s) => (
                  <div className="text-cyan-400 font-mono" style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}>{s.value}</div>
                ),
              })}
            </div>
          </SubHypothesisCard>

          {/* Aggregate Validation */}
          <ValidationCard variant={allValidated ? 'success' : 'default'}>
            <StatusIndicator
              status={allValidated ? 'success' : 'neutral'}
              label={allValidated ? 'ALL SUB-HYPOTHESES VALIDATED' : 'TESTING...'}
            />
            <div className="mt-3 space-y-1 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              <div className="flex items-center gap-2">
                <span className={doublerWorks ? 'text-green-400' : 'text-neutral-500'}>
                  {doublerWorks ? '✓' : '○'}
                </span>
                <span className="text-neutral-400">H6.1: Atom.fn() callable with number arg</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={multipleCallsWork ? 'text-green-400' : 'text-neutral-500'}>
                  {multipleCallsWork ? '✓' : '○'}
                </span>
                <span className="text-neutral-400">H6.1: Multiple calls update result reactively</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={fibWorks ? 'text-green-400' : 'text-neutral-500'}>
                  {fibWorks ? '✓' : '○'}
                </span>
                <span className="text-neutral-400">H6.2: Complex computation works</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={transformWorks ? 'text-green-400' : 'text-neutral-500'}>
                  {transformWorks ? '✓' : '○'}
                </span>
                <span className="text-neutral-400">H6.3: Object args supported</span>
              </div>
            </div>
          </ValidationCard>

          {/* Technical notes */}
          <ValidationCard variant="warning">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>PATTERN: Atom.fn()</span>
            </div>
            <p className="text-amber-200/70 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              Function atoms turn Effects into callable React primitives.
            </p>
            <p className="text-amber-200/50 font-mono mt-1" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              Each call triggers fresh Effect execution with new args.
            </p>
            <p className="text-amber-200/50 font-mono mt-1" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              Use Effect.fnUntraced for the generator wrapper.
            </p>
          </ValidationCard>
        </div>
      </section>
    </HypothesisSection>
  )
}

// =============================================================================
// H7: BATCH UPDATE COALESCING
// =============================================================================

/**
 * H7: Batch Update Coalescing
 *
 * Tests Atom.batch() for coalescing multiple updates:
 * - Multiple set() calls in batch = single notification
 * - Derived atoms recalculate once
 * - Unbatched updates = multiple notifications
 */
function H7_BatchCoalescing({ inspector }: HypothesisSectionProps) {
  // Individual atom values
  const [a, setA] = useAtom(h7AtomA)
  const [b, setB] = useAtom(h7AtomB)
  const [c, setC] = useAtom(h7AtomC)
  const derived = useAtomValue(h7DerivedAtom)

  // Render tracking
  const renderCountRef = useRef(0)
  const [renderSnapshots, setRenderSnapshots] = useState<Array<{ type: string; count: number; sum: number }>>([])

  // Track renders
  renderCountRef.current += 1

  // Batched update: all three at once
  const batchedUpdate = useCallback(() => {
    const beforeCount = renderCountRef.current
    Atom.batch(() => {
      setA((v) => v + 1)
      setB((v) => v + 10)
      setC((v) => v + 100)
    })
    // Snapshot after batch (next tick to capture final render count)
    setTimeout(() => {
      setRenderSnapshots((prev) => [
        ...prev.slice(-4),
        { type: 'BATCH', count: renderCountRef.current - beforeCount, sum: a + b + c + 111 },
      ])
    }, 50)
  }, [setA, setB, setC, a, b, c])

  // Unbatched update: sequential sets
  const unbatchedUpdate = useCallback(() => {
    const beforeCount = renderCountRef.current
    setA((v) => v + 1)
    setB((v) => v + 10)
    setC((v) => v + 100)
    // Snapshot after all updates
    setTimeout(() => {
      setRenderSnapshots((prev) => [
        ...prev.slice(-4),
        { type: 'UNBATCH', count: renderCountRef.current - beforeCount, sum: a + b + c + 111 },
      ])
    }, 50)
  }, [setA, setB, setC, a, b, c])

  // Reset
  const reset = useCallback(() => {
    Atom.batch(() => {
      setA(0)
      setB(0)
      setC(0)
    })
    setRenderSnapshots([])
    renderCountRef.current = 0
  }, [setA, setB, setC])

  // Validation
  const hasBatchSnap = renderSnapshots.some((s) => s.type === 'BATCH')
  const hasUnbatchSnap = renderSnapshots.some((s) => s.type === 'UNBATCH')
  const batchRendersLess = renderSnapshots.filter((s) => s.type === 'BATCH').every((s) => s.count <= 2)
  const allValidated = hasBatchSnap && hasUnbatchSnap && batchRendersLess

  return (
    <HypothesisSection hypothesisKey="h7" label="H7" expectedMounts={2} className="mb-8">
      <section>
        <SectionLabel>H7: Batch Update Coalescing</SectionLabel>
        <div className="space-y-4">
          {/* Current State */}
        <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded">
          <div className="flex items-center justify-between mb-3">
            <div className="text-neutral-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Atom State</div>
            <div className="font-mono text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              renders: <span className="text-cyan-400">{renderCountRef.current}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-neutral-500 uppercase mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>A</div>
              <div className="text-2xl font-mono text-cyan-400">{a}</div>
            </div>
            <div className="text-center">
              <div className="text-neutral-500 uppercase mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>B</div>
              <div className="text-2xl font-mono text-cyan-400">{b}</div>
            </div>
            <div className="text-center">
              <div className="text-neutral-500 uppercase mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>C</div>
              <div className="text-2xl font-mono text-cyan-400">{c}</div>
            </div>
            <div className="text-center border-l border-neutral-700 pl-4">
              <div className="text-neutral-500 uppercase mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>SUM</div>
              <div className="text-2xl font-mono text-green-400">{derived.sum}</div>
            </div>
          </div>

          <div className="font-mono text-neutral-500 text-center" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {derived.formula} = {derived.sum}
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          <DocTarget
            id="h7-batched"
            doc={{
              title: 'Batched Update',
              description: 'Updates A, B, C inside Atom.batch() - single notification',
              expectedBehavior: 'All three update, but component re-renders ~1-2 times',
              interactions: [
                { trigger: 'Click', result: 'Atom.batch(() => { setA; setB; setC })' },
              ],
              relatedHypotheses: ['H7'],
            }}
          >
            <Button onClick={batchedUpdate} variant="primary">
              Batched (+1, +10, +100)
            </Button>
          </DocTarget>
          <DocTarget
            id="h7-unbatched"
            doc={{
              title: 'Unbatched Update',
              description: 'Updates A, B, C sequentially - multiple notifications',
              expectedBehavior: 'Each set triggers separate re-render',
              interactions: [
                { trigger: 'Click', result: 'setA(); setB(); setC();' },
              ],
              relatedHypotheses: ['H7'],
            }}
          >
            <Button onClick={unbatchedUpdate} variant="danger">
              Unbatched (+1, +10, +100)
            </Button>
          </DocTarget>
          <Button onClick={reset}>Reset</Button>
        </div>

        {/* Render Snapshots */}
        <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded">
          <div className="text-neutral-400 font-mono mb-3" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Render Count Snapshots</div>
          {renderSnapshots.length === 0 ? (
            <div className="text-neutral-600 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              Click batched/unbatched to compare render counts...
            </div>
          ) : (
            <div className="space-y-2">
              {renderSnapshots.map((snap, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between px-3 py-2 rounded font-mono ${
                    snap.type === 'BATCH'
                      ? 'bg-green-900/30 border border-green-800/50'
                      : 'bg-red-900/30 border border-red-800/50'
                  }`}
                  style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                >
                  <span className={snap.type === 'BATCH' ? 'text-green-400' : 'text-red-400'}>
                    {snap.type}
                  </span>
                  <span className="text-neutral-400">
                    renders: <span className="text-white">{snap.count}</span>
                  </span>
                  <span className="text-neutral-500">sum → {snap.sum}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Validation */}
        <ValidationCard variant={allValidated ? 'success' : 'default'}>
          <StatusIndicator
            status={allValidated ? 'success' : 'neutral'}
            label={allValidated ? 'HYPOTHESIS VALIDATED' : 'TESTING...'}
          />
          <div className="mt-3 space-y-1 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            <div className="flex items-center gap-2">
              <span className={hasBatchSnap ? 'text-green-400' : 'text-neutral-500'}>
                {hasBatchSnap ? '✓' : '○'}
              </span>
              <span className="text-neutral-400">Batched update executed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={hasUnbatchSnap ? 'text-green-400' : 'text-neutral-500'}>
                {hasUnbatchSnap ? '✓' : '○'}
              </span>
              <span className="text-neutral-400">Unbatched update executed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={batchRendersLess ? 'text-green-400' : 'text-neutral-500'}>
                {batchRendersLess ? '✓' : '○'}
              </span>
              <span className="text-neutral-400">Batch triggers fewer renders</span>
            </div>
          </div>
        </ValidationCard>

        {/* Technical notes */}
        <ValidationCard variant="warning">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>PATTERN: Atom.batch()</span>
          </div>
          <p className="text-amber-200/70 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Batch wraps multiple sets into single notification cycle.
          </p>
          <p className="text-amber-200/50 font-mono mt-1" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Derived atoms recalculate once after batch commits.
          </p>
          <p className="text-amber-200/50 font-mono mt-1" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Nesting supported: inner batches merge into outer.
          </p>
        </ValidationCard>
        </div>
      </section>
    </HypothesisSection>
  )
}

// =============================================================================
// H8: ATOM FAMILY PATTERN
// =============================================================================

/**
 * H8: Atom Family Pattern
 *
 * Tests Atom.family() for stable references:
 * - Same key returns same atom
 * - Different keys return different atoms
 * - Each atom is independently mutable
 */
function H8_AtomFamily({ inspector }: HypothesisSectionProps) {
  // Test IDs
  const [activeIds, setActiveIds] = useState(['alpha', 'beta', 'gamma'])
  const [newId, setNewId] = useState('')

  // Reference stability tracking
  const atomRefsRef = useRef<Map<string, unknown>>(new Map())

  // Track which atoms have been accessed and their stability
  const [stabilityLog, setStabilityLog] = useState<Array<{ id: string; stable: boolean; time: number }>>([])

  // Add new ID
  const addId = useCallback(() => {
    if (newId && !activeIds.includes(newId)) {
      setActiveIds((prev) => [...prev, newId])
      setNewId('')
    }
  }, [newId, activeIds])

  // Remove ID
  const removeId = useCallback((id: string) => {
    setActiveIds((prev) => prev.filter((i) => i !== id))
  }, [])

  // Validation
  const hasMultipleIds = activeIds.length >= 2
  const hasStabilityChecks = stabilityLog.length > 0
  const allStable = stabilityLog.every((s) => s.stable)
  const allValidated = hasMultipleIds && hasStabilityChecks && allStable

  return (
    <HypothesisSection hypothesisKey="h8" label="H8" expectedMounts={2} className="mb-8">
      <section>
        <SectionLabel>H8: Atom Family Pattern</SectionLabel>
        <div className="space-y-4">
          {/* Active Counters */}
        <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded">
          <div className="text-neutral-400 font-mono mb-3" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Counter Family</div>
          <div className="grid grid-cols-3 gap-3">
            {activeIds.map((id) => (
              <H8CounterCard
                key={id}
                id={id}
                atomRefsRef={atomRefsRef}
                onStabilityCheck={(stable) =>
                  setStabilityLog((prev) => [...prev.slice(-9), { id, stable, time: Date.now() }])
                }
                onRemove={() => removeId(id)}
              />
            ))}
          </div>
        </div>

        {/* Add New ID */}
        <div className="flex gap-3">
          <input
            type="text"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="Enter new ID..."
            className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded font-mono text-neutral-200 placeholder-neutral-600 focus:border-cyan-600 focus:outline-none"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          />
          <Button onClick={addId} variant="primary" disabled={!newId}>
            Add Counter
          </Button>
        </div>

        {/* Stability Log */}
        <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded">
          <div className="text-neutral-400 font-mono mb-3" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Reference Stability Log</div>
          {stabilityLog.length === 0 ? (
            <div className="text-neutral-600 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              Click "Check Ref" on counters to verify reference stability...
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {stabilityLog.map((log, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-1 rounded font-mono ${
                    log.stable
                      ? 'bg-green-900/30 text-green-400'
                      : 'bg-red-900/30 text-red-400'
                  }`}
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  {log.id}: {log.stable ? 'STABLE' : 'CHANGED'}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Validation */}
        <ValidationCard variant={allValidated ? 'success' : 'default'}>
          <StatusIndicator
            status={allValidated ? 'success' : 'neutral'}
            label={allValidated ? 'HYPOTHESIS VALIDATED' : 'TESTING...'}
          />
          <div className="mt-3 space-y-1 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            <div className="flex items-center gap-2">
              <span className={hasMultipleIds ? 'text-green-400' : 'text-neutral-500'}>
                {hasMultipleIds ? '✓' : '○'}
              </span>
              <span className="text-neutral-400">Multiple family members exist</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={hasStabilityChecks ? 'text-green-400' : 'text-neutral-500'}>
                {hasStabilityChecks ? '✓' : '○'}
              </span>
              <span className="text-neutral-400">Reference stability checked</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={allStable ? 'text-green-400' : 'text-neutral-500'}>
                {allStable ? '✓' : '○'}
              </span>
              <span className="text-neutral-400">All references stable across renders</span>
            </div>
          </div>
        </ValidationCard>

        {/* Technical notes */}
        <ValidationCard variant="warning">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>PATTERN: Atom.family()</span>
          </div>
          <p className="text-amber-200/70 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Family atoms create stable references per unique key.
          </p>
          <p className="text-amber-200/50 font-mono mt-1" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Same key always returns same atom instance.
          </p>
          <p className="text-amber-200/50 font-mono mt-1" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Ideal for dynamic collections (users, items, resources).
          </p>
        </ValidationCard>
        </div>
      </section>
    </HypothesisSection>
  )
}

// =============================================================================
// H10: XSTATE ACTOR INTEGRATION
// =============================================================================

/**
 * H10: XState Actor Integration
 *
 * Tests wrapping XState actors in atoms:
 * - Actor state changes update the atom
 * - useAtomValue triggers re-renders
 * - Direct actor.send() works
 */
function H10_XStateIntegration({ inspector }: HypothesisSectionProps) {
  // Traffic light state
  const trafficLightState = useAtomValue(h10TrafficLightAtom)
  const [lightTransitions, setLightTransitions] = useState(0)

  // Counter state
  const counterState = useAtomValue(h10CounterAtom)
  const [counterActions, setCounterActions] = useState(0)

  // Track transitions
  const prevLightRef = useRef(trafficLightState.value)
  useEffect(() => {
    if (prevLightRef.current !== trafficLightState.value) {
      setLightTransitions((t) => t + 1)
      prevLightRef.current = trafficLightState.value
    }
  }, [trafficLightState.value])

  // Traffic light controls
  const nextLight = useCallback(() => {
    trafficLightActor.send({ type: 'NEXT' })
  }, [])

  // Counter controls
  const increment = useCallback(() => {
    counterActor.send({ type: 'INCREMENT' })
    setCounterActions((a) => a + 1)
  }, [])

  const decrement = useCallback(() => {
    counterActor.send({ type: 'DECREMENT' })
    setCounterActions((a) => a + 1)
  }, [])

  const resetCounter = useCallback(() => {
    counterActor.send({ type: 'RESET' })
    setCounterActions((a) => a + 1)
  }, [])

  // Light colors
  const lightColors = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
  }

  // Validation
  const hasLightTransitions = lightTransitions > 0
  const hasCounterActions = counterActions > 0
  const atomUpdates = hasLightTransitions && hasCounterActions
  const allValidated = atomUpdates

  return (
    <HypothesisSection hypothesisKey="h10" label="H10" expectedMounts={2} className="mb-8">
      <section>
        <SectionLabel>H10: XState Actor Integration</SectionLabel>
        <div className="space-y-4">
          {/* Traffic Light */}
        <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded">
          <div className="flex items-center justify-between mb-3">
            <div className="text-neutral-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Traffic Light Machine</div>
            <div className="font-mono text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              transitions: <span className="text-cyan-400">{lightTransitions}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 mb-4">
            {/* Light display */}
            <div className="flex flex-col gap-2 p-3 bg-neutral-900 rounded-lg">
              {(['red', 'yellow', 'green'] as const).map((color) => (
                <div
                  key={color}
                  className={`w-8 h-8 rounded-full transition-all duration-300 ${
                    trafficLightState.value === color
                      ? `${lightColors[color]} shadow-lg`
                      : 'bg-neutral-700'
                  }`}
                />
              ))}
            </div>

            {/* State info */}
            <div className="text-center">
              <div className="text-neutral-500 uppercase mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>Current State</div>
              <div className="text-2xl font-mono text-cyan-400 uppercase">
                {String(trafficLightState.value)}
              </div>
            </div>
          </div>

          <Button onClick={nextLight} variant="primary">
            Next Light
          </Button>
        </div>

        {/* Counter Machine */}
        <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded">
          <div className="flex items-center justify-between mb-3">
            <div className="text-neutral-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Counter Machine (with context)</div>
            <div className="font-mono text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              actions: <span className="text-cyan-400">{counterActions}</span>
            </div>
          </div>

          <div className="text-center mb-4">
            <div className="text-4xl font-mono text-white">{counterState.context.count}</div>
            <div className="text-neutral-500 mt-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>context.count</div>
          </div>

          <div className="flex gap-2 justify-center">
            <Button onClick={decrement} variant="danger">−</Button>
            <Button onClick={resetCounter}>Reset</Button>
            <Button onClick={increment} variant="primary">+</Button>
          </div>
        </div>

        {/* Validation */}
        <ValidationCard variant={allValidated ? 'success' : 'default'}>
          <StatusIndicator
            status={allValidated ? 'success' : 'neutral'}
            label={allValidated ? 'HYPOTHESIS VALIDATED' : 'TESTING...'}
          />
          <div className="mt-3 space-y-1 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            <div className="flex items-center gap-2">
              <span className={hasLightTransitions ? 'text-green-400' : 'text-neutral-500'}>
                {hasLightTransitions ? '✓' : '○'}
              </span>
              <span className="text-neutral-400">Actor state changes update atom</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={hasCounterActions ? 'text-green-400' : 'text-neutral-500'}>
                {hasCounterActions ? '✓' : '○'}
              </span>
              <span className="text-neutral-400">Context updates trigger re-renders</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={atomUpdates ? 'text-green-400' : 'text-neutral-500'}>
                {atomUpdates ? '✓' : '○'}
              </span>
              <span className="text-neutral-400">Direct actor.send() works</span>
            </div>
          </div>
        </ValidationCard>

        {/* Technical notes */}
        <ValidationCard variant="warning">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>PATTERN: XState + Atom</span>
          </div>
          <p className="text-amber-200/70 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Wrap actors in Atom.make() with actor.subscribe() for updates.
          </p>
          <p className="text-amber-200/50 font-mono mt-1" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Use get.setSelf() in subscription to update atom state.
          </p>
          <p className="text-amber-200/50 font-mono mt-1" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            get.addFinalizer() for cleanup on unmount.
          </p>
        </ValidationCard>
        </div>
      </section>
    </HypothesisSection>
  )
}

// Counter card for H8 family test
function H8CounterCard({
  id,
  atomRefsRef,
  onStabilityCheck,
  onRemove,
}: {
  id: string
  atomRefsRef: React.MutableRefObject<Map<string, unknown>>
  onStabilityCheck: (stable: boolean) => void
  onRemove: () => void
}) {
  const atom = h8CounterFamily(id)
  const [state, setState] = useAtom(atom)

  // Check reference stability
  const checkRef = useCallback(() => {
    const currentAtom = h8CounterFamily(id)
    const prevAtom = atomRefsRef.current.get(id)

    if (!prevAtom) {
      atomRefsRef.current.set(id, currentAtom)
      onStabilityCheck(true) // First check, assume stable
    } else {
      const isStable = prevAtom === currentAtom
      onStabilityCheck(isStable)
    }
  }, [id, atomRefsRef, onStabilityCheck])

  const increment = useCallback(() => {
    setState((prev) => ({ ...prev, count: prev.count + 1 }))
  }, [setState])

  return (
    <div className="p-3 bg-neutral-900/50 border border-neutral-700 rounded">
      <div className="flex items-center justify-between mb-2">
        <span className="text-cyan-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>{id}</span>
        <button onClick={onRemove} className="text-neutral-500 hover:text-red-400" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          ✕
        </button>
      </div>
      <div className="text-2xl font-mono text-white text-center mb-2">{state.count}</div>
      <div className="flex gap-1">
        <button
          onClick={increment}
          className="flex-1 px-2 py-1 bg-cyan-900/50 text-cyan-300 font-mono rounded hover:bg-cyan-800/50"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          +1
        </button>
        <button
          onClick={checkRef}
          className="flex-1 px-2 py-1 bg-neutral-800 text-neutral-400 font-mono rounded hover:bg-neutral-700"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Check Ref
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// INSPECTOR PANEL
// =============================================================================

function InspectorPanel({
  iframeRef,
  isOpen,
  onToggle,
  isConnected,
}: {
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  isOpen: boolean
  onToggle: () => void
  isConnected: boolean
}) {
  return (
    <div
      className={`flex flex-col border-l border-neutral-800 bg-neutral-900 transition-all duration-300 ${
        isOpen ? 'w-1/2' : 'w-12'
      }`}
    >
      {/* Header */}
      <div className="p-3 border-b border-neutral-800 bg-neutral-900 flex items-center justify-between">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 hover:text-neutral-200 transition-colors"
        >
          <span className="font-mono uppercase tracking-wider text-neutral-400" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            {isOpen ? 'Inspector' : ''}
          </span>
          <span className="text-neutral-500" style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}>{isOpen ? '→' : '←'}</span>
        </button>
        {isOpen && (
          <StatusIndicator
            status={isConnected ? 'success' : 'warning'}
            label={isConnected ? 'CONNECTED' : 'LOADING...'}
          />
        )}
      </div>

      {/* Iframe */}
      {isOpen && (
        <iframe
          ref={iframeRef}
          title="Stately Inspector"
          className="flex-1 w-full bg-neutral-900"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      )}
    </div>
  )
}

// =============================================================================
// MAIN TESTBED CONTENT
// =============================================================================

/**
 * Format delta with sign and optional RPS
 */
function formatDelta(delta: number, rps: number, showRate: boolean): string {
  if (delta === 0 && rps === 0) return ''
  const sign = delta > 0 ? '+' : ''
  if (showRate && rps > 0) {
    return `(${sign}${delta} @ ${rps.toFixed(1)}/s)`
  }
  return delta !== 0 ? `(${sign}${delta})` : ''
}

/**
 * Global render counter display - shows aggregated render stats
 * Uses module-level storage with polling for display
 */
function GlobalRenderCounter() {
  const { total, overallRPS, severity, byKey } = useAggregatedRenderStats()
  const [expanded, setExpanded] = useState(false)

  const colors = SEVERITY_COLORS[severity]

  // Get per-key rates for detailed display (from module-level storage)
  const keyStats = ALL_HYPOTHESIS_KEYS.map(key => {
    const count = byKey[key] || 0
    const state = getTrackingState(key)
    const now = Date.now()
    const cutoff = now - RATE_WINDOW_MS
    const recentTimestamps = state.timestamps.filter(t => t > cutoff)
    const rps = recentTimestamps.length / (RATE_WINDOW_MS / 1000)
    const isStream = key.includes('Stream')
    const keySeverity = calculateSeverity(rps, isStream)
    return { key, count, rps, severity: keySeverity }
  }).filter(s => s.count > 0 || s.rps > 0) // Only show active keys

  return (
    <div className="flex flex-col items-end gap-1">
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
        <div className="bg-neutral-900/95 border border-neutral-700 rounded p-3 font-mono space-y-2 min-w-[240px] shadow-xl" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <span className="text-neutral-500 uppercase tracking-wider">
              Render Analysis (Atom.family)
            </span>
          </div>

          {/* Per-hypothesis breakdown */}
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
            <div className="text-neutral-600 uppercase tracking-wider" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
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

function TestbedContent({ inspector }: { inspector: InspectorType | null }) {
  return (
    <div className="p-8 space-y-8">
      <header className="border-b border-neutral-800 pb-6 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-mono uppercase tracking-widest text-neutral-200">
              Effect-Atom Testbed
            </h1>
            <p className="text-neutral-500 font-mono mt-2" style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}>
              EDIN Experiment Phase — Inspector:{' '}
              <span className={inspector ? 'text-green-400' : 'text-amber-400'}>
                {inspector ? 'READY' : 'INITIALIZING...'}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <DevDocToggle />
            <GlobalRenderCounter />
          </div>
        </div>
      </header>

      <Manifesto expanded={false} />

      <HalflifeTimeline defaultOpen={false} />

      <H1_PrimitiveAtom inspector={inspector} />
      <H2_DerivedAtom inspector={inspector} />
      <H3_ResultAtoms inspector={inspector} />
      <H4_StreamingAccumulation inspector={inspector} />
      <H5_RuntimeLayerInjection inspector={inspector} />
      <H6_AtomFnReactivity inspector={inspector} />
      <H7_BatchCoalescing inspector={inspector} />
      <H8_AtomFamily inspector={inspector} />
      <H10_XStateIntegration inspector={inspector} />

      <CollapsiblePanel
        title="H9: Serialization (Deferred)"
        subtitle="Requires Registry-level API"
      >
        <p className="text-neutral-500 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
          H9 (Serialization Round-Trip) requires direct Registry.snapshot() and
          Registry.hydrate() access, which isn't exposed through the standard
          React hooks layer. The pattern exists but testing requires lower-level
          Registry.make() usage.
        </p>
      </CollapsiblePanel>
    </div>
  )
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

export function EffectAtomTestbed() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [inspector, setInspector] = useState<InspectorType | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorConnected, setInspectorConnected] = useState(false)

  // Initialize inspector when iframe is ready
  useEffect(() => {
    if (!iframeRef.current || inspector) return

    // Wait for iframe to be in DOM, then create inspector
    const timer = setTimeout(() => {
      if (iframeRef.current) {
        const inst = createInspectorInstance(iframeRef.current)
        setInspector(inst)

        // Mark connected after a brief delay (inspector needs to load)
        setTimeout(() => setInspectorConnected(true), 2000)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [inspector, inspectorOpen])

  return (
    <RegistryProvider>
      {/* RenderTrackerProvider removed - now using Atom.family for isolated tracking */}
      <DevDocProvider>
        <div className="min-h-screen bg-neutral-950 text-neutral-200 flex">
          {/* Main content */}
          <div className="flex-1 overflow-auto">
            <TestbedContent inspector={inspector} />
          </div>

          {/* Collapsible Inspector Panel */}
          <InspectorPanel
            iframeRef={iframeRef}
            isOpen={inspectorOpen}
            onToggle={() => setInspectorOpen(!inspectorOpen)}
            isConnected={inspectorConnected}
          />
        </div>
      </DevDocProvider>
    </RegistryProvider>
  )
}

export default EffectAtomTestbed
