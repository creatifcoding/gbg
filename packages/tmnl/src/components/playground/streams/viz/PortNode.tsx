/**
 * Port Node
 *
 * Unit-inspired inlet/outlet visual for topology graphs.
 * Represents a connection point in the stream topology.
 *
 * @module
 */

import { memo } from 'react'

// =============================================================================
// TYPES
// =============================================================================

export type PortKind = 'inlet' | 'outlet' | 'junction'
export type PortStatus = 'idle' | 'active' | 'error' | 'backpressure'

export interface PortNodeProps {
  /** Port identifier */
  id: string
  /** Port display label */
  label: string
  /** Port type */
  kind: PortKind
  /** Current status */
  status?: PortStatus
  /** Current throughput (events/sec) */
  throughput?: number
  /** Is this port selected */
  selected?: boolean
  /** Click handler */
  onClick?: () => void
}

// =============================================================================
// CONSTANTS
// =============================================================================

const KIND_COLORS = {
  inlet: {
    bg: 'bg-cyan-900/30',
    border: 'border-cyan-700',
    icon: '→',
    iconColor: 'text-cyan-400',
  },
  outlet: {
    bg: 'bg-emerald-900/30',
    border: 'border-emerald-700',
    icon: '←',
    iconColor: 'text-emerald-400',
  },
  junction: {
    bg: 'bg-amber-900/30',
    border: 'border-amber-700',
    icon: '◆',
    iconColor: 'text-amber-400',
  },
} as const

const STATUS_INDICATORS = {
  idle: { color: 'bg-neutral-600', pulse: false },
  active: { color: 'bg-green-400', pulse: true },
  error: { color: 'bg-red-400', pulse: true },
  backpressure: { color: 'bg-amber-400', pulse: true },
} as const

// =============================================================================
// PORT NODE
// =============================================================================

/**
 * Visual representation of a stream port (inlet/outlet/junction).
 *
 * Features:
 * - Type-specific styling (inlet=cyan, outlet=green, junction=amber)
 * - Status indicator with pulse animation
 * - Throughput display
 * - Selection state
 */
export const PortNode = memo(function PortNode({
  id,
  label,
  kind,
  status = 'idle',
  throughput,
  selected = false,
  onClick,
}: PortNodeProps) {
  const kindStyle = KIND_COLORS[kind]
  const statusStyle = STATUS_INDICATORS[status]

  return (
    <div
      className={`
        relative p-3 rounded-lg border-2 cursor-pointer transition-all
        ${kindStyle.bg} ${kindStyle.border}
        ${selected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-neutral-950' : ''}
        hover:brightness-110
      `}
      onClick={onClick}
      data-port-id={id}
      data-port-kind={kind}
    >
      {/* Status indicator */}
      <div
        className={`
          absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-neutral-950
          ${statusStyle.color}
          ${statusStyle.pulse ? 'animate-pulse' : ''}
        `}
      />

      {/* Port icon */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`${kindStyle.iconColor} font-mono`}
          style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
        >
          {kindStyle.icon}
        </span>
        <span
          className="font-mono uppercase tracking-wider text-neutral-300"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {kind}
        </span>
      </div>

      {/* Label */}
      <div
        className="font-mono text-neutral-100 truncate"
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      >
        {label}
      </div>

      {/* Throughput */}
      {throughput !== undefined && (
        <div
          className="font-mono text-neutral-500 mt-1"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {throughput.toLocaleString()}/s
        </div>
      )}
    </div>
  )
})

export default PortNode
