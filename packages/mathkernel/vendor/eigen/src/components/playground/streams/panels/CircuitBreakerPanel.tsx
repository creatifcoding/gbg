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
import {
  StateNode,
  TransitionArrow,
  TransitionRule,
  getStateColors,
  type FsmStateType,
} from '@/components/primitives'

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

/** Map circuit breaker states to FSM state types */
const STATE_TYPE_MAP: Record<CircuitState, FsmStateType> = {
  closed: 'success',
  open: 'error',
  'half-open': 'warning',
}

const STATE_DESCRIPTIONS: Record<CircuitState, string> = {
  closed: 'Normal operation. All requests pass through.',
  open: 'Failing. All requests rejected immediately.',
  'half-open': 'Testing. Single request allowed to test recovery.',
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
            className={`font-mono uppercase ${getStateColors(STATE_TYPE_MAP[state]).text}`}
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
            <StateNode type="success" isActive={state === 'closed'} label="Closed" />
            <TransitionArrow direction="right" />
            <StateNode type="error" isActive={state === 'open'} label="Open" />
            <TransitionArrow direction="right" />
            <StateNode type="warning" isActive={state === 'half-open'} label="Half-Open" />
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
              fromType="success"
              toType="error"
              condition={`${threshold} failures`}
              isActive={state === 'closed'}
            />
            <TransitionRule
              from="open"
              to="half-open"
              fromType="error"
              toType="warning"
              condition="timeout"
              isActive={state === 'open'}
            />
            <TransitionRule
              from="half-open"
              to="closed"
              fromType="warning"
              toType="success"
              condition="success"
              isActive={state === 'half-open'}
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

export default CircuitBreakerPanel
