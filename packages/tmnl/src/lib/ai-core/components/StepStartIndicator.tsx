/**
 * StepStartIndicator
 *
 * Visual indicator for step boundaries in AI streaming.
 * Provides subtle visual separation between reasoning steps.
 *
 * Minimal brutalist design - just a horizontal rule with subtle styling.
 *
 * @example
 * ```tsx
 * <StepStartIndicator />
 * ```
 */

import * as React from 'react'
import { memo } from 'react'
import { RVN_SPACING } from '@/lib/rvn/tokens'

// =============================================================================
// Types
// =============================================================================

export interface StepStartIndicatorProps {
  /** Custom className */
  className?: string
  /** Custom style overrides */
  style?: React.CSSProperties
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    margin: `${RVN_SPACING.s} 0`,
    height: '1px',
    background: '#333',
    opacity: 0.5,
  },
} as const

// =============================================================================
// Component
// =============================================================================

export const StepStartIndicator = memo(function StepStartIndicator({
  className,
  style,
}: StepStartIndicatorProps) {
  return <div className={className} style={{ ...styles.container, ...style }} role="separator" />
})

export default StepStartIndicator
