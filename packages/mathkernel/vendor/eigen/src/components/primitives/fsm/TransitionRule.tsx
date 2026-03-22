/**
 * TransitionRule - FSM transition rule display primitive
 *
 * Displays a state transition rule with:
 * - Source state
 * - Target state
 * - Condition/trigger text
 *
 * @module primitives/fsm
 */

import { type FsmStateType, getStateColors } from './StateNode'

// =============================================================================
// TYPES
// =============================================================================

export interface TransitionRuleProps {
  /** Source state name */
  from: string
  /** Target state name */
  to: string
  /** Transition condition/trigger */
  condition: string
  /** Whether this rule is currently active/highlighted */
  isActive?: boolean
  /** Source state type (for color) */
  fromType?: FsmStateType
  /** Target state type (for color) */
  toType?: FsmStateType
  /** Additional className */
  className?: string
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Transition rule display for finite state machine visualization.
 *
 * @example Basic usage
 * ```tsx
 * <TransitionRule
 *   from="closed"
 *   to="open"
 *   condition="5 failures"
 *   fromType="success"
 *   toType="error"
 *   isActive
 * />
 * ```
 *
 * @example Grid of rules
 * ```tsx
 * <div className="grid grid-cols-3 gap-2">
 *   <TransitionRule from="closed" to="open" condition="failures" />
 *   <TransitionRule from="open" to="half-open" condition="timeout" />
 *   <TransitionRule from="half-open" to="closed" condition="success" />
 * </div>
 * ```
 */
export function TransitionRule({
  from,
  to,
  condition,
  isActive = false,
  fromType = 'neutral',
  toType = 'neutral',
  className = '',
}: TransitionRuleProps) {
  const fromColors = getStateColors(fromType)
  const toColors = getStateColors(toType)

  return (
    <div
      className={`
        p-2 rounded border transition-colors
        ${isActive
          ? 'border-neutral-600 bg-neutral-800/50'
          : 'border-neutral-800 opacity-50'
        }
        ${className}
      `}
    >
      {/* State transition */}
      <div
        className="flex items-center gap-1 text-neutral-400"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        <span className={fromColors.text}>{from}</span>
        <span>→</span>
        <span className={toColors.text}>{to}</span>
      </div>

      {/* Condition */}
      <div
        className="text-neutral-500 mt-1"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {condition}
      </div>
    </div>
  )
}

export default TransitionRule
