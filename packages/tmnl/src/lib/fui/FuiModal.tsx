/**
 * FuiModal
 *
 * Composed FUI modal - vantablack, no frills.
 * Backdrop + elevation, that's it.
 */

import { type ReactNode, type CSSProperties } from 'react'
import { AnimatePresence } from 'framer-motion'
import { FuiBackdrop } from './FuiBackdrop'
import { FuiElevation } from './FuiElevation'

// =============================================================================
// TYPES
// =============================================================================

export interface FuiModalProps {
  /** Controls visibility */
  open: boolean
  /** Called when modal should close (backdrop click) */
  onClose?: () => void
  /** Modal content */
  children: ReactNode
  /** Snap to full viewport */
  fullScreen?: boolean
  /** Max width of modal (ignored if fullScreen) */
  maxWidth?: string | number
  /** Max height of modal (ignored if fullScreen) */
  maxHeight?: string | number
  /** Additional className for elevation container */
  className?: string
  /** Additional style for elevation container */
  style?: CSSProperties
  /** Called when entrance animation completes */
  onOpenComplete?: () => void
  /** Called when exit animation completes */
  onCloseComplete?: () => void
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FuiModal({
  open,
  onClose,
  children,
  fullScreen = false,
  maxWidth = 800,
  maxHeight = '85vh',
  className,
  style,
  onOpenComplete,
  onCloseComplete,
}: FuiModalProps) {
  return (
    <AnimatePresence onExitComplete={onCloseComplete}>
      {open && (
        <>
          <FuiBackdrop visible={open} onClick={onClose} />
          <FuiElevation
            visible={open}
            fullScreen={fullScreen}
            maxWidth={maxWidth}
            maxHeight={maxHeight}
            className={className}
            style={style}
            onEnterComplete={onOpenComplete}
          >
            {children}
          </FuiElevation>
        </>
      )}
    </AnimatePresence>
  )
}
