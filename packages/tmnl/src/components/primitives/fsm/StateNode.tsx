/**
 * StateNode - FSM state visualization primitive
 *
 * Renders a single state in a finite state machine diagram with:
 * - Configurable colors per state type
 * - Active/inactive visual states
 * - Pulsing indicator for active state
 *
 * @module primitives/fsm
 */

import { type ReactNode } from 'react'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Semantic state types for FSM visualization.
 */
export type FsmStateType =
  | 'success'   // Green - healthy/closed/active
  | 'error'     // Red - error/open/failed
  | 'warning'   // Amber - transitional/half-open/pending
  | 'info'      // Cyan - informational
  | 'neutral'   // Gray - default

/**
 * Color configuration for a state type.
 */
export interface StateColors {
  bg: string
  border: string
  text: string
  ring: string
  indicator: string
}

export interface StateNodeProps {
  /** Display label for the state */
  label: string
  /** Semantic state type */
  type?: FsmStateType
  /** Whether this state is currently active */
  isActive?: boolean
  /** Show pulsing indicator */
  showIndicator?: boolean
  /** Additional className */
  className?: string
  /** Children content */
  children?: ReactNode
  /** Custom colors (override type defaults) */
  colors?: Partial<StateColors>
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STATE_COLORS: Record<FsmStateType, StateColors> = {
  success: {
    bg: 'bg-green-900/30',
    border: 'border-green-700',
    text: 'text-green-400',
    ring: 'ring-green-400',
    indicator: 'bg-green-400',
  },
  error: {
    bg: 'bg-red-900/30',
    border: 'border-red-700',
    text: 'text-red-400',
    ring: 'ring-red-400',
    indicator: 'bg-red-400',
  },
  warning: {
    bg: 'bg-amber-900/30',
    border: 'border-amber-700',
    text: 'text-amber-400',
    ring: 'ring-amber-400',
    indicator: 'bg-amber-400',
  },
  info: {
    bg: 'bg-cyan-900/30',
    border: 'border-cyan-700',
    text: 'text-cyan-400',
    ring: 'ring-cyan-400',
    indicator: 'bg-cyan-400',
  },
  neutral: {
    bg: 'bg-neutral-900/30',
    border: 'border-neutral-700',
    text: 'text-neutral-400',
    ring: 'ring-neutral-400',
    indicator: 'bg-neutral-400',
  },
}

const SIZE_CLASSES = {
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
}

const SIZE_FONTS = {
  sm: 'var(--tmnl-text-xs, 12px)',
  md: 'var(--tmnl-text-sm, 14px)',
  lg: 'var(--tmnl-text-base, 16px)',
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * State node for finite state machine visualization.
 *
 * @example Basic usage
 * ```tsx
 * <StateNode label="Closed" type="success" isActive />
 * <StateNode label="Open" type="error" />
 * <StateNode label="Half-Open" type="warning" />
 * ```
 *
 * @example Custom colors
 * ```tsx
 * <StateNode
 *   label="Processing"
 *   colors={{ bg: 'bg-purple-900/30', text: 'text-purple-400' }}
 *   isActive
 * />
 * ```
 */
export function StateNode({
  label,
  type = 'neutral',
  isActive = false,
  showIndicator = true,
  className = '',
  children,
  colors: customColors,
  size = 'md',
}: StateNodeProps) {
  const colors = { ...STATE_COLORS[type], ...customColors }

  return (
    <div
      className={`
        relative rounded-lg border-2 transition-all
        ${colors.bg} ${colors.border}
        ${SIZE_CLASSES[size]}
        ${isActive ? `ring-2 ring-offset-2 ring-offset-neutral-950 ${colors.ring}` : 'opacity-50'}
        ${className}
      `}
    >
      {/* Status indicator */}
      {isActive && showIndicator && (
        <div
          className={`
            absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-neutral-950
            ${colors.indicator}
            animate-pulse
          `}
        />
      )}

      {/* Label */}
      <div
        className={`font-mono uppercase tracking-wider ${colors.text}`}
        style={{ fontSize: SIZE_FONTS[size] }}
      >
        {label}
      </div>

      {/* Optional children */}
      {children}
    </div>
  )
}

/**
 * Get colors for a given state type.
 * Useful for consistency across related components.
 */
export function getStateColors(type: FsmStateType): StateColors {
  return STATE_COLORS[type]
}

export default StateNode
