/**
 * ClickableAffordance Trait
 *
 * Makes elements obviously interactive with:
 * - Tooltip on hover
 * - Glow ring animation
 * - Cursor change
 * - Optional pulse animation
 * - Optional badge indicator
 */

import { useState, type CSSProperties } from 'react'
import { createTrait } from '../createTrait'
import type { ClickableAffordanceSlot } from '../types'

// =============================================================================
// GLOW COLORS
// =============================================================================

const GLOW_COLORS: Record<NonNullable<ClickableAffordanceSlot['glow']>, string> = {
  orange: 'rgba(251, 146, 60, 0.6)',   // orange-400
  cyan: 'rgba(34, 211, 238, 0.6)',     // cyan-400
  violet: 'rgba(167, 139, 250, 0.6)',  // violet-400
  green: 'rgba(74, 222, 128, 0.6)',    // green-400
  red: 'rgba(248, 113, 113, 0.6)',     // red-400
  amber: 'rgba(251, 191, 36, 0.6)',    // amber-400
}

const GLOW_BORDERS: Record<NonNullable<ClickableAffordanceSlot['glow']>, string> = {
  orange: 'border-orange-500/50',
  cyan: 'border-cyan-500/50',
  violet: 'border-violet-500/50',
  green: 'border-green-500/50',
  red: 'border-red-500/50',
  amber: 'border-amber-500/50',
}

// =============================================================================
// TOOLTIP COMPONENT
// =============================================================================

function Tooltip({ text, visible }: { text: string; visible: boolean }) {
  if (!visible || !text) return null

  return (
    <div
      className="absolute z-50 px-2 py-1 text-xs font-mono bg-neutral-900 border border-neutral-700 rounded shadow-lg whitespace-nowrap pointer-events-none"
      style={{
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: '4px',
      }}
    >
      {text}
      {/* Arrow */}
      <div
        className="absolute w-2 h-2 bg-neutral-900 border-r border-b border-neutral-700 rotate-45"
        style={{
          bottom: '-5px',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />
    </div>
  )
}

// =============================================================================
// GLOW RING COMPONENT
// =============================================================================

function GlowRing({
  color,
  pulse,
}: {
  color: NonNullable<ClickableAffordanceSlot['glow']>
  pulse?: boolean
}) {
  const glowColor = GLOW_COLORS[color]
  const borderClass = GLOW_BORDERS[color]

  return (
    <div
      className={`absolute inset-0 rounded border ${borderClass} pointer-events-none ${pulse ? 'animate-pulse' : ''}`}
      style={{
        boxShadow: `0 0 8px 2px ${glowColor}, inset 0 0 4px 1px ${glowColor}`,
      }}
    />
  )
}

// =============================================================================
// BADGE COMPONENT
// =============================================================================

function Badge({ text, color }: { text: string; color?: ClickableAffordanceSlot['glow'] }) {
  const bgClass = color ? `bg-${color}-900/50` : 'bg-neutral-800'
  const textClass = color ? `text-${color}-400` : 'text-neutral-400'

  return (
    <span
      className={`absolute -top-1 -right-1 px-1 py-0.5 font-mono uppercase rounded ${bgClass} ${textClass} pointer-events-none`}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {text}
    </span>
  )
}

// =============================================================================
// AFFORDANCE WRAPPER
// =============================================================================

function AffordanceWrapper({
  slot,
  targetId,
}: {
  slot: ClickableAffordanceSlot
  targetId: string
}) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <>
      {/* Hover detector (invisible overlay) */}
      <div
        className="absolute inset-0 z-10"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: slot.cursor ?? 'pointer' }}
      />

      {/* Glow ring */}
      {slot.glow && <GlowRing color={slot.glow} pulse={slot.pulse} />}

      {/* Tooltip */}
      {slot.tooltip && <Tooltip text={slot.tooltip} visible={isHovered} />}

      {/* Badge */}
      {slot.badge && <Badge text={slot.badge} color={slot.glow} />}
    </>
  )
}

// =============================================================================
// TRAIT DEFINITION
// =============================================================================

export const ClickableAffordance = createTrait<ClickableAffordanceSlot>({
  id: 'clickable-affordance',

  render: (slot, targetId) => <AffordanceWrapper slot={slot} targetId={targetId} />,

  style: (slot): CSSProperties => ({
    position: 'relative',
    cursor: slot.cursor ?? 'pointer',
  }),

  className: (slot) => {
    const classes: string[] = []
    if (slot.glow) {
      classes.push('hover:brightness-110', 'transition-all', 'duration-150')
    }
    return classes.join(' ')
  },
})

export default ClickableAffordance
