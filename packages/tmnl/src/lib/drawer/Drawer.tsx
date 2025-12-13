/**
 * Drawer Component
 *
 * The actual drawer surface with backdrop, content area, and close affordances.
 * Animates with rolodex effect on enter/exit.
 *
 * @module
 */

import { useRef, useEffect, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useDrawerStack } from './DrawerStackContext'
import {
  cardStackIn,
  cardStackOut,
  animateStackDepth,
  resetCardStackStyles,
} from './animations'
import type { DrawerInstance, DrawerSide } from './types'

// =============================================================================
// STYLES
// =============================================================================

const getDrawerStyles = (
  side: DrawerSide,
  width: number | string,
  height: number | string,
  zIndex: number
): React.CSSProperties => {
  const base: React.CSSProperties = {
    position: 'fixed',
    zIndex,
    // TMNL CEW: Pure black surface
    backgroundColor: 'black',
    borderColor: 'rgb(38, 38, 38)', // neutral-800
    borderWidth: 1,
    borderStyle: 'solid',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }

  switch (side) {
    case 'left':
      return {
        ...base,
        top: 0,
        left: 0,
        bottom: 0,
        width: typeof width === 'number' ? `${width}px` : width,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderBottomWidth: 0,
      }
    case 'right':
      return {
        ...base,
        top: 0,
        right: 0,
        bottom: 0,
        width: typeof width === 'number' ? `${width}px` : width,
        borderRightWidth: 0,
        borderTopWidth: 0,
        borderBottomWidth: 0,
      }
    case 'bottom':
      return {
        ...base,
        left: 0,
        right: 0,
        bottom: 0,
        height: typeof height === 'number' ? `${height}px` : height,
        borderBottomWidth: 0,
        borderLeftWidth: 0,
        borderRightWidth: 0,
      }
    case 'top':
      return {
        ...base,
        left: 0,
        right: 0,
        top: 0,
        height: typeof height === 'number' ? `${height}px` : height,
        borderTopWidth: 0,
        borderLeftWidth: 0,
        borderRightWidth: 0,
      }
  }
}

const backdropStyles: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  // TMNL CEW: Deep black backdrop with subtle blur
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(1px)',
}

const headerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: '8px 12px',
  // TMNL CEW: Hairline border
  borderBottom: '1px solid rgb(38, 38, 38)', // neutral-800
  flexShrink: 0,
}

const closeButtonStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 4,
  border: 'none',
  backgroundColor: 'transparent',
  // TMNL CEW: Muted text
  color: 'rgb(82, 82, 82)', // neutral-600
  cursor: 'pointer',
  transition: 'background-color 0.15s, color 0.15s',
}

const contentStyles: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: 16,
}

// =============================================================================
// DRAWER COMPONENT
// =============================================================================

interface DrawerProps {
  instance: DrawerInstance
  /** Portal container (from slot) */
  container: HTMLElement
  /** Position in stack (0 = bottom, stackSize-1 = top) */
  stackIndex: number
  /** Total drawers in stack */
  stackSize: number
}

export function Drawer({ instance, container, stackIndex, stackSize }: DrawerProps) {
  const { pop, setAnimationState } = useDrawerStack()
  const drawerRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  const {
    id,
    content,
    side = 'right',
    width = 400,
    height = '50%',
    zIndex,
    showBackdrop = true,
    closeOnOverlayClick = true,
    closeOnEscape = true,
    animationState,
  } = instance

  // Compute stack depth (0 = top, 1+ = recessed)
  const stackDepth = stackSize - 1 - stackIndex

  // -------------------------------------------------------------------------
  // Close handler
  // -------------------------------------------------------------------------
  const handleClose = useCallback(() => {
    pop(id)
  }, [pop, id])

  // -------------------------------------------------------------------------
  // Enter animation
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (animationState === 'entering' && drawerRef.current) {
      cardStackIn(drawerRef.current, side).then(() => {
        setAnimationState(id, 'visible')
      })
    }
  }, [animationState, id, side, setAnimationState])

  // -------------------------------------------------------------------------
  // Exit animation
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (animationState === 'exiting' && drawerRef.current) {
      cardStackOut(drawerRef.current, side).then(() => {
        setAnimationState(id, 'exited')
      })
    }
  }, [animationState, id, side, setAnimationState])

  // -------------------------------------------------------------------------
  // Stack depth animation (recessed card effect)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (animationState === 'visible' && drawerRef.current) {
      animateStackDepth(drawerRef.current, stackDepth, side)
    }
  }, [animationState, stackDepth, side])

  // -------------------------------------------------------------------------
  // Escape key handler
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!closeOnEscape) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeOnEscape, handleClose])

  // -------------------------------------------------------------------------
  // Click outside handler
  // -------------------------------------------------------------------------
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnOverlayClick && e.target === backdropRef.current) {
        handleClose()
      }
    },
    [closeOnOverlayClick, handleClose]
  )

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (drawerRef.current) {
        resetCardStackStyles(drawerRef.current)
      }
    }
  }, [])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const drawerContent = (
    <>
      {/* Backdrop */}
      {showBackdrop && (
        <div
          ref={backdropRef}
          style={{ ...backdropStyles, zIndex: zIndex - 1 }}
          onClick={handleBackdropClick}
        />
      )}

      {/* Drawer surface */}
      <div
        ref={drawerRef}
        style={getDrawerStyles(side, width, height, zIndex)}
        role="dialog"
        aria-modal="true"
      >
        {/* Header with close button */}
        <div style={headerStyles}>
          <button
            style={closeButtonStyles}
            onClick={handleClose}
            aria-label="Close drawer"
            onMouseEnter={(e) => {
              // TMNL CEW: Elevated hover state
              e.currentTarget.style.backgroundColor = 'rgb(23, 23, 23)' // neutral-900
              e.currentTarget.style.color = 'white'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'rgb(82, 82, 82)' // neutral-600
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={contentStyles}>{content}</div>
      </div>
    </>
  )

  return createPortal(drawerContent, container)
}

// =============================================================================
// DRAWER RENDERER (renders all drawers for a slot)
// =============================================================================

interface DrawerRendererProps {
  slotId: string
  container: HTMLElement
}

export function DrawerRenderer({ slotId, container }: DrawerRendererProps) {
  const { getDrawersForSlot } = useDrawerStack()
  const drawers = getDrawersForSlot(slotId)
  const stackSize = drawers.length

  return (
    <>
      {drawers.map((instance, index) => (
        <Drawer
          key={instance.id}
          instance={instance}
          container={container}
          stackIndex={index}
          stackSize={stackSize}
        />
      ))}
    </>
  )
}
