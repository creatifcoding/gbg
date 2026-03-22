/**
 * FuiScanline
 *
 * Sweeping scanline effect that travels across content.
 * Creates a "boot scan" visual for FUI elevation entrances.
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FUI_TIMING, FUI_EASING, FUI_COLORS } from './tokens'

// =============================================================================
// TYPES
// =============================================================================

export interface FuiScanlineProps {
  /** Trigger the sweep animation */
  active: boolean
  /** Direction of sweep */
  direction?: 'down' | 'up' | 'left' | 'right'
  /** Number of sweeps (default: 1) */
  sweeps?: number
  /** Delay before starting (ms) */
  delay?: number
  /** Called when sweep completes */
  onComplete?: () => void
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FuiScanline({
  active,
  direction = 'down',
  sweeps = 1,
  delay = 0,
  onComplete,
}: FuiScanlineProps) {
  const [sweepCount, setSweepCount] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setSweepCount(0)
      setVisible(false)
      return
    }

    const timer = setTimeout(() => {
      setVisible(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [active, delay])

  const handleAnimationComplete = () => {
    const nextCount = sweepCount + 1
    if (nextCount >= sweeps) {
      setVisible(false)
      onComplete?.()
    } else {
      setSweepCount(nextCount)
    }
  }

  const isHorizontal = direction === 'down' || direction === 'up'

  // Animation variants based on direction
  const variants = {
    initial: {
      [isHorizontal ? 'y' : 'x']:
        direction === 'down' || direction === 'right' ? '-100%' : '100%',
      opacity: 0,
    },
    animate: {
      [isHorizontal ? 'y' : 'x']:
        direction === 'down' || direction === 'right' ? '100%' : '-100%',
      opacity: [0, 1, 1, 0],
    },
    exit: {
      opacity: 0,
    },
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ zIndex: 100 }}
        >
          <motion.div
            className="absolute"
            style={{
              ...(isHorizontal
                ? { left: 0, right: 0, height: 2 }
                : { top: 0, bottom: 0, width: 2 }),
              background: `linear-gradient(
                ${isHorizontal ? 'to bottom' : 'to right'},
                transparent,
                ${FUI_COLORS.glow},
                transparent
              )`,
              boxShadow: `0 0 20px 4px ${FUI_COLORS.glowSubtle}`,
            }}
            key={sweepCount}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{
              duration: FUI_TIMING.scanlineSweep / 1000,
              ease: FUI_EASING.sweep,
              times: [0, 0.1, 0.9, 1],
            }}
            onAnimationComplete={handleAnimationComplete}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// =============================================================================
// STATIC SCANLINES (CRT effect)
// =============================================================================

export interface FuiStaticScanlinesProps {
  /** Opacity of scanlines (0-1) */
  opacity?: number
  /** Line spacing in pixels */
  spacing?: number
}

/**
 * Static CRT-style scanlines overlay
 */
export function FuiStaticScanlines({
  opacity = 0.03,
  spacing = 2,
}: FuiStaticScanlinesProps) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity,
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent ${spacing}px,
          rgba(0, 0, 0, 0.3) ${spacing}px,
          rgba(0, 0, 0, 0.3) ${spacing * 2}px
        )`,
      }}
    />
  )
}
