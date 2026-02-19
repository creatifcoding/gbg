/**
 * ChatTokenUsage.Ring — SVG circular progress ring showing context usage.
 *
 * @module chat/msg/token-usage
 */

import { forwardRef, memo, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useChatTokenUsage } from './token-usage-context'

// =============================================================================
// Constants
// =============================================================================

const RADIUS = 10
const VIEWBOX = 24
const CENTER = 12
const STROKE_WIDTH = 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// =============================================================================
// Props
// =============================================================================

export interface ChatTokenUsageRingProps extends ComponentPropsWithoutRef<'svg'> {
  /** Override size (px). Default: 16 */
  size?: number
}

// =============================================================================
// Component
// =============================================================================

export const ChatTokenUsageRing = memo(forwardRef<SVGSVGElement, ChatTokenUsageRingProps>(
  ({ size = 16, className, ...props }, ref) => {
    const { usedPercent, isLoading } = useChatTokenUsage()
    const dashOffset = CIRCUMFERENCE * (1 - usedPercent)

    // Color based on usage
    const strokeColor =
      usedPercent > 0.9 ? 'text-red-400' :
      usedPercent > 0.7 ? 'text-amber-400' :
      'text-cyan-400'

    return (
      <svg
        ref={ref}
        data-slot="tmnl-chat-token-ring"
        width={size}
        height={size}
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        role="img"
        aria-label={`Context usage: ${Math.round(usedPercent * 100)}%`}
        className={cn(strokeColor, isLoading && 'animate-pulse', className)}
        {...props}
      >
        {/* Background track */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          opacity={0.15}
        />
        {/* Progress arc */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transformOrigin: 'center', transform: 'rotate(-90deg)' }}
          opacity={0.8}
        />
      </svg>
    )
  },
))

ChatTokenUsageRing.displayName = 'ChatTokenUsage.Ring'
