/**
 * FuiElevation
 *
 * Vantablack container that scales in cleanly.
 * No glow. No pulse. Pure darkness.
 */

import { type ReactNode, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { FUI_TIMING, FUI_EASING, FUI_COLORS, FUI_GEOMETRY } from './tokens'

// =============================================================================
// TYPES
// =============================================================================

export interface FuiElevationProps {
  /** Controls visibility and animation state */
  visible: boolean
  /** Content to elevate */
  children: ReactNode
  /** Z-index (default: 50) */
  zIndex?: number
  /** Snap to full viewport (with small margin) */
  fullScreen?: boolean
  /** Custom max width (ignored if fullScreen) */
  maxWidth?: string | number
  /** Custom max height (ignored if fullScreen) */
  maxHeight?: string | number
  /** Additional className */
  className?: string
  /** Additional style */
  style?: CSSProperties
  /** Callback when entrance animation completes */
  onEnterComplete?: () => void
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FuiElevation({
  visible,
  children,
  zIndex = 50,
  fullScreen = false,
  maxWidth = '90vw',
  maxHeight = '85vh',
  className = '',
  style,
  onEnterComplete,
}: FuiElevationProps) {
  if (!visible) return null

  // Full screen: calc(100vw/vh - margin)
  const sizeStyles = fullScreen
    ? {
        width: 'calc(100vw - 32px)',
        height: 'calc(100vh - 32px)',
      }
    : {
        maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
        maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
      }

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className={`
          pointer-events-auto
          overflow-hidden
          ${className}
        `}
        style={{
          ...sizeStyles,
          backgroundColor: FUI_COLORS.vantablack,
          border: `1px solid ${FUI_COLORS.border}`,
          ...style,
        }}
        initial={{
          scale: FUI_GEOMETRY.scaleFrom,
          opacity: 0,
        }}
        animate={{
          scale: FUI_GEOMETRY.scaleTo,
          opacity: 1,
        }}
        exit={{
          scale: FUI_GEOMETRY.scaleFrom,
          opacity: 0,
        }}
        transition={{
          duration: FUI_TIMING.elevation / 1000,
          ease: FUI_EASING.enter,
        }}
        onAnimationComplete={(definition) => {
          if (typeof definition === 'object' && 'opacity' in definition && definition.opacity === 1) {
            onEnterComplete?.()
          }
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
