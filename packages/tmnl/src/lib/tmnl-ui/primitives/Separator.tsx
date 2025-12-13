/**
 * TMNL Separator Component
 *
 * CEW-styled divider lines.
 */

import { cn } from '../utils/cn'
import { TMNL_TOKENS } from '../tokens'

// =============================================================================
// TYPES
// =============================================================================

interface SeparatorProps {
  className?: string
  orientation?: 'horizontal' | 'vertical'
}

// =============================================================================
// SEPARATOR
// =============================================================================

export function Separator({ className, orientation = 'horizontal' }: SeparatorProps) {
  return (
    <div
      className={cn(
        TMNL_TOKENS.bg.elevated,
        orientation === 'horizontal' ? 'h-px w-full' : 'w-px h-full',
        className
      )}
      role="separator"
      aria-orientation={orientation}
    />
  )
}
