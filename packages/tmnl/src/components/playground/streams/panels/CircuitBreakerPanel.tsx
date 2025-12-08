/**
 * Circuit Breaker Panel
 *
 * FSM visualization for circuit breaker state.
 *
 * @module
 */

import { useAtomValue } from '@effect-atom/atom-react'
import { circuitBreakerAtom } from '@/lib/streams/playground'
import { D3Gauge } from '../viz'

// =============================================================================
// TYPES
// =============================================================================

type CircuitState = 'closed' | 'open' | 'half-open'

interface CircuitBreakerPanelProps {
  /** Current state override (for demo) */
  state?: CircuitState
  /** Failure count */
  failureCount?: number
  /** Success count */
  successCount?: number
  /** Failure threshold */
  threshold?: number
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STATE_COLORS: Record<CircuitState, { bg: string; border: string; text: string }> = {
  closed: {
    bg: 'bg-green-900/30',
    border: 'border-green-700',
    text: 'text-green-400',
  },
  open: {
    bg: 'bg-red-900/30',
    border: 'border-red-700',
    text: 'text-red-400',
  },
  'half-open': {
    bg: 'bg-amber-900/30',
    border: 'border-amber-700',
    text: 'text-amber-400',
  },
}

const STATE_DESCRIPTIONS: Record<CircuitState, string> = {
  closed: 'Normal operation. All requests pass through.',
  open: 'Failing. All requests rejected immediately.',
  'half-open': 'Testing. Single request allowed to test recovery.',
}

// =============================================================================
// STATE NODE
// =============================================================================

interface StateNodeProps {
  state: CircuitState
  isActive: boolean
  label: string
}

function StateNode({ state, isActive, label }: StateNodeProps) {
  const colors = STATE_COLORS[state]

  return (
    <div
      className={`
        relative p-4 rounded-lg border-2 transition-all
        ${colors.bg} ${colors.border}
        ${isActive ? 'ring-2 ring-offset-2 ring-offset-neutral-950' : 'opacity-50'}
        ${isActive && state === 'closed' ? 'ring-green-400' : ''}
        ${isActive && state === 'open' ? 'ring-red-400' : ''}
        ${isActive && state === 'half-open' ? 'ring-amber-400' : ''}
      `}
    >
      {/* Status indicator */}
      {isActive && (
        <div
          className={`
            absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-neutral-950
            ${state === 'closed' ? 'bg-green-400' : state === 'open' ? 'bg-red-400' : 'bg-amber-400'}
            animate-pulse
          `}
        />
      )}

      <div
        className={`font-mono uppercase tracking-wider ${colors.text}`}
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      >
        {label}
      </div>
    </div>
  )
}

// =============================================================================
// TRANSITION ARROW
// =============================================================================

function TransitionArrow({ direction }: { direction: 'right' | 'down' | 'up' }) {
  const arrows = {
    right: '→',
    down: '↓',
    up: '↑',
  }

  return (
    <span
      className="text-neutral-600 font-mono"
      style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
    >
      {arrows[direction]}
    </span>
  )
}

// =============================================================================
// CIRCUIT BREAKER PANEL
// =============================================================================

/**
 * Circuit breaker state machine visualization.
 *
 * Shows:
 * - Current state (closed/open/half-open)
 * - State machine diagram
 * - Failure/success counters
 * - Threshold gauge
 */
export function CircuitBreakerPanel({
  state: propState,
  failureCount: propFailureCount,
  successCount: propSuccessCount,
  threshold = 5,
}: CircuitBreakerPanelProps) {
  // Atoms now return values directly (Atom-as-State pattern)
  // circuitBreakerAtom returns null when no circuit breaker data
  const circuitBreaker = useAtomValue(circuitBreakerAtom)

  const state: CircuitState = propState ?? (circuitBreaker?.state as CircuitState) ?? 'closed'
  const failureCount = propFailureCount ?? circuitBreaker?.failureCount ?? 0
  const successCount = propSuccessCount ?? circuitBreaker?.successCount ?? 0

  const failurePercentage = Math.min(100, (failureCount / threshold) * 100)

  return (
    <div className="p-4 bg-neutral-900/30 rounded-lg border border-neutral-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3
          className="font-mono uppercase tracking-wider text-neutral-300"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          Circuit Breaker
        </h3>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              state === 'closed' ? 'bg-green-500' : state === 'open' ? 'bg-red-500' : 'bg-amber-500'
            }`}
          />
          <span
            className={`font-mono uppercase ${STATE_COLORS[state].text}`}
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            {state}
          </span>
        </div>
      </div>

      <div className="flex items-start gap-8">
        {/* State machine diagram */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-4">
            <StateNode state="closed" isActive={state === 'closed'} label="Closed" />
            <TransitionArrow direction="right" />
            <StateNode state="open" isActive={state === 'open'} label="Open" />
            <TransitionArrow direction="right" />
            <StateNode state="half-open" isActive={state === 'half-open'} label="Half-Open" />
          </div>

          {/* Description */}
          <p
            className="text-neutral-500"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {STATE_DESCRIPTIONS[state]}
          </p>

          {/* Transition rules */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <TransitionRule
              from="closed"
              to="open"
              condition={`${threshold} failures`}
              active={state === 'closed'}
            />
            <TransitionRule
              from="open"
              to="half-open"
              condition="timeout"
              active={state === 'open'}
            />
            <TransitionRule
              from="half-open"
              to="closed"
              condition="success"
              active={state === 'half-open'}
            />
          </div>
        </div>

        {/* Gauges */}
        <div className="flex flex-col items-center gap-4">
          <D3Gauge
            value={failurePercentage}
            label="Failures"
            size={120}
            thresholds={{ medium: 50, high: 80 }}
          />

          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div
                className="font-mono text-red-400 font-bold"
                style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
              >
                {failureCount}
              </div>
              <div
                className="text-neutral-500"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                Failures
              </div>
            </div>
            <div>
              <div
                className="font-mono text-green-400 font-bold"
                style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
              >
                {successCount}
              </div>
              <div
                className="text-neutral-500"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                Successes
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-800 text-neutral-500 font-mono"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        <span>Threshold: {threshold} failures</span>
        <span>
          {failureCount}/{threshold} ({failurePercentage.toFixed(0)}%)
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// HELPERS
// =============================================================================

interface TransitionRuleProps {
  from: CircuitState
  to: CircuitState
  condition: string
  active: boolean
}

function TransitionRule({ from, to, condition, active }: TransitionRuleProps) {
  return (
    <div
      className={`p-2 rounded border ${
        active ? 'border-neutral-600 bg-neutral-800/50' : 'border-neutral-800 opacity-50'
      }`}
    >
      <div
        className="flex items-center gap-1 text-neutral-400"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        <span className={STATE_COLORS[from].text}>{from}</span>
        <span>→</span>
        <span className={STATE_COLORS[to].text}>{to}</span>
      </div>
      <div
        className="text-neutral-500 mt-1"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {condition}
      </div>
    </div>
  )
}

export default CircuitBreakerPanel
