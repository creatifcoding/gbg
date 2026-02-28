/**
 * SmartDot — The connection indicator dot.
 *
 * Three branches:
 * 1. Spinning (connecting/reconnecting) → amber ring spinner
 * 2. Connected + smart color → latency-interpolated bg, CSS transition
 * 3. Phase dot → Tailwind class from PHASE_STYLES
 *
 * @module connection-capsule/smart-dot
 */

import { memo } from 'react'
import { cn } from '@/lib/utils'
import type { ConnectionPhase } from '../../schemas/message-types'
import type { PhaseStyle } from './phase-styles'

interface SmartDotProps {
  phase: ConnectionPhase
  style: PhaseStyle
  smartColor?: string
  smartGlow?: string
}

export const SmartDot = memo(function SmartDot({
  phase, style, smartColor, smartGlow,
}: SmartDotProps) {
  // Branch 1: Spinner (connecting/reconnecting)
  if (style.spinning) {
    return (
      <span
        className="block rounded-full animate-spin"
        style={{
          width: 5, height: 5,
          border: '1.5px solid',
          borderColor: phase === 'connecting' || phase === 'reconnecting'
            ? '#fbbf24' : '#a3a3a3',
          borderTopColor: 'transparent',
        }}
      />
    )
  }

  // Branch 2: Smart dot (connected + latency-interpolated color)
  if (smartColor) {
    return (
      <span
        className="block w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor: smartColor,
          boxShadow: smartGlow || undefined,
          transition: 'background-color 200ms ease-out, box-shadow 200ms ease-out',
        }}
      />
    )
  }

  // Branch 3: Phase dot (Tailwind class from PHASE_STYLES)
  return (
    <span
      className={cn('block w-1.5 h-1.5 rounded-full', style.dotColor)}
      style={{ boxShadow: style.dotGlow || undefined }}
    />
  )
})
