/**
 * TransitionArrow - FSM transition arrow primitive
 *
 * Visual connector between states in a finite state machine diagram.
 *
 * @module primitives/fsm
 */

// =============================================================================
// TYPES
// =============================================================================

export type ArrowDirection =
  | 'right'
  | 'left'
  | 'up'
  | 'down'
  | 'diag-up-right'
  | 'diag-down-right'
  | 'diag-up-left'
  | 'diag-down-left'

export interface TransitionArrowProps {
  /** Arrow direction */
  direction?: ArrowDirection
  /** Arrow label (displayed below/beside arrow) */
  label?: string
  /** Whether this transition is active/highlighted */
  isActive?: boolean
  /** Additional className */
  className?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ARROW_CHARS: Record<ArrowDirection, string> = {
  right: '→',
  left: '←',
  up: '↑',
  down: '↓',
  'diag-up-right': '↗',
  'diag-down-right': '↘',
  'diag-up-left': '↖',
  'diag-down-left': '↙',
}

const SIZE_FONTS = {
  sm: 'var(--tmnl-text-sm, 14px)',
  md: 'var(--tmnl-text-lg, 18px)',
  lg: 'var(--tmnl-text-xl, 20px)',
}

const LABEL_FONTS = {
  sm: 'var(--tmnl-text-xs, 12px)',
  md: 'var(--tmnl-text-xs, 12px)',
  lg: 'var(--tmnl-text-sm, 14px)',
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Transition arrow for finite state machine visualization.
 *
 * @example Basic usage
 * ```tsx
 * <TransitionArrow direction="right" />
 * ```
 *
 * @example With label
 * ```tsx
 * <TransitionArrow direction="right" label="on success" />
 * ```
 *
 * @example Vertical
 * ```tsx
 * <TransitionArrow direction="down" label="timeout" isActive />
 * ```
 */
export function TransitionArrow({
  direction = 'right',
  label,
  isActive = false,
  className = '',
  size = 'md',
}: TransitionArrowProps) {
  const isVertical = direction === 'up' || direction === 'down'

  return (
    <span
      className={`
        inline-flex items-center gap-1
        ${isVertical ? 'flex-col' : 'flex-row'}
        ${isActive ? 'text-neutral-400' : 'text-neutral-600'}
        font-mono
        ${className}
      `}
    >
      <span style={{ fontSize: SIZE_FONTS[size] }}>
        {ARROW_CHARS[direction]}
      </span>
      {label && (
        <span
          className="text-neutral-500"
          style={{ fontSize: LABEL_FONTS[size] }}
        >
          {label}
        </span>
      )}
    </span>
  )
}

export default TransitionArrow
