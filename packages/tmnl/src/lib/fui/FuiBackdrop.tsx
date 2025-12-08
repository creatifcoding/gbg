/**
 * FuiBackdrop
 *
 * Dark backdrop overlay with blur.
 * Vantablack aesthetic - no grain, no vignette frills.
 */

import { motion } from 'framer-motion'
import { FUI_TIMING, FUI_EASING, FUI_COLORS, FUI_GEOMETRY } from './tokens'

// =============================================================================
// TYPES
// =============================================================================

export interface FuiBackdropProps {
  /** Controls visibility */
  visible: boolean
  /** Called when backdrop is clicked */
  onClick?: () => void
  /** Z-index (default: 40) */
  zIndex?: number
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FuiBackdrop({
  visible,
  onClick,
  zIndex = 40,
}: FuiBackdropProps) {
  if (!visible) return null

  return (
    <motion.div
      className="fixed inset-0"
      style={{
        zIndex,
        backgroundColor: FUI_COLORS.backdrop,
        backdropFilter: `blur(${FUI_GEOMETRY.backdropBlur}px)`,
        WebkitBackdropFilter: `blur(${FUI_GEOMETRY.backdropBlur}px)`,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: FUI_TIMING.backdropFade / 1000,
        ease: FUI_EASING.enter,
      }}
      onClick={onClick}
    />
  )
}
