/**
 * InteractiveCard v2
 *
 * Wrapper component that enables cards to operate in multiple modes:
 * - modal: Click expands card into centered modal dialog
 * - floating: Card becomes draggable floating panel
 * - both: Default is modal, with option to detach to floating
 *
 * v2 Changes:
 * - Uses stx-powered floating panel system
 * - Proper modal ↔ floating bidirectional flow
 * - Uses useModalOptional for safe modal context access
 *
 * @pattern Compound interaction modes + stx backbone
 * @module
 */

import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { Card, type CardProps } from './card'
import {
  FloatingPanel,
  getFloatingStx,
  registerPanel,
  unregisterPanel,
  closePanel,
} from '@/lib/floating'
import { useSelector } from '@/lib/stx'
import { useModalOptional } from '@/components/base/BaseModal/BaseModal'
import type { VisitorContract, ModalActions } from '@/components/base/BaseModal/types'

// =============================================================================
// Types
// =============================================================================

export type InteractiveCardMode = 'modal' | 'floating' | 'both'

export interface InteractiveCardProps extends Omit<CardProps, 'onClick'> {
  /** Unique identifier for this card */
  id: string
  /** Interaction mode */
  mode?: InteractiveCardMode
  /** Visitor contract for modal/floating content */
  visitor?: VisitorContract
  /** Data to pass to visitor */
  visitorData?: unknown
  /** Initial position for floating mode */
  initialPosition?: { x: number; y: number }
  /** Initial dimensions for floating mode */
  initialDimensions?: { width: number; height: number }
  /** Callback when card is clicked in modal mode */
  onOpenModal?: () => void
  /** Callback when card is detached to floating */
  onDetach?: () => void
  /** Callback when floating panel is docked back to modal */
  onDock?: () => void
  /** Children to render inside the card */
  children?: ReactNode
}

// =============================================================================
// Detach Icon
// =============================================================================

function DetachIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1h5v5M13 1L6 8M5 3H2a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// =============================================================================
// Component
// =============================================================================

/**
 * Interactive card with multiple interaction modes.
 * Supports modal ↔ floating bidirectional mode switching.
 *
 * @example Modal mode
 * ```tsx
 * <ModalProvider visitors={[settingsVisitor]}>
 *   <InteractiveCard
 *     id="settings"
 *     mode="modal"
 *     visitor={settingsVisitor}
 *     visitorData={{ userId: 123 }}
 *   >
 *     Settings Card
 *   </InteractiveCard>
 * </ModalProvider>
 * ```
 *
 * @example Floating mode
 * ```tsx
 * <FloatingPanelProvider>
 *   <InteractiveCard
 *     id="inspector"
 *     mode="floating"
 *     visitor={inspectorVisitor}
 *     visitorData={selectedItem}
 *     initialPosition={{ x: 100, y: 100 }}
 *   >
 *     Inspector Panel
 *   </InteractiveCard>
 * </FloatingPanelProvider>
 * ```
 *
 * @example Both modes (click for modal, detach for floating)
 * ```tsx
 * <ModalProvider visitors={[detailsVisitor]}>
 *   <FloatingPanelProvider>
 *     <InteractiveCard
 *       id="details"
 *       mode="both"
 *       visitor={detailsVisitor}
 *       visitorData={item}
 *     >
 *       Details Card
 *     </InteractiveCard>
 *   </FloatingPanelProvider>
 * </ModalProvider>
 * ```
 */
export function InteractiveCard({
  id,
  mode = 'modal',
  visitor,
  visitorData,
  initialPosition = { x: 100, y: 100 },
  initialDimensions = { width: 400, height: 300 },
  onOpenModal,
  onDetach,
  onDock,
  children,
  className = '',
  ...cardProps
}: InteractiveCardProps) {
  // Track if we're in floating mode (for 'both' mode)
  const [isFloating, setIsFloating] = useState(false)

  // Access modal context (optional - may not be in ModalProvider)
  const modal = useModalOptional()

  // Access floating panel state from stx
  const stx = getFloatingStx()
  const panelsMap = useSelector(stx.data.panels, (p) => p)
  const panel = panelsMap.get(id)

  // For mode === 'floating', register panel on mount
  useEffect(() => {
    if (mode === 'floating') {
      registerPanel({
        id,
        title: visitor?.detachTitle ?? visitor?.id ?? id,
        initialPosition,
        initialDimensions,
      })

      return () => {
        unregisterPanel(id)
      }
    }
  }, [id, mode, visitor?.detachTitle, visitor?.id, initialPosition, initialDimensions])

  // Handle card click (opens modal in modal/both mode)
  const handleClick = useCallback(() => {
    if (mode === 'modal' || (mode === 'both' && !isFloating)) {
      if (modal && visitor) {
        // Use modal context to open
        modal.open(visitor.id, visitorData)
      }
      onOpenModal?.()
    }
  }, [mode, isFloating, modal, visitor, visitorData, onOpenModal])

  // Handle detach (modal → floating)
  const handleDetach = useCallback(() => {
    // Close modal if open
    modal?.close()

    // Register floating panel BEFORE setting isFloating
    registerPanel({
      id,
      title: visitor?.detachTitle ?? visitor?.id ?? id,
      initialPosition,
      initialDimensions,
    })

    setIsFloating(true)
    onDetach?.()
  }, [id, modal, visitor, initialPosition, initialDimensions, onDetach])

  // Handle dock (floating → modal)
  const handleDock = useCallback(() => {
    // Close floating panel
    closePanel(id)

    // Open modal with same data
    if (modal && visitor) {
      modal.open(visitor.id, visitorData)
    }

    setIsFloating(false)
    onDock?.()
  }, [id, modal, visitor, visitorData, onDock])

  // Handle close (when floating panel is closed)
  const handleClose = useCallback(() => {
    closePanel(id)
    setIsFloating(false)
  }, [id])

  // Actions for visitor render
  const floatingActions: ModalActions = {
    close: handleClose,
    setData: () => {},
    detach: handleDock, // In floating mode, "detach" means dock back
  }

  // Floating mode: only render if panel exists in stx
  const shouldShowFloating = (mode === 'floating' || isFloating) && panel

  if (shouldShowFloating) {
    return (
      <FloatingPanel
        id={id}
        title={visitor?.detachTitle ?? visitor?.id ?? id}
        onClose={handleClose}
        onToggleMode={handleDock}
      >
        {visitor && visitorData !== undefined ? (
          visitor.render(visitorData, floatingActions)
        ) : (
          children
        )}
      </FloatingPanel>
    )
  }

  // Modal mode: render as clickable card
  return (
    <Card
      className={`cursor-pointer transition-transform hover:scale-[1.02] ${className}`}
      onClick={handleClick}
      {...cardProps}
    >
      {children}
      {mode === 'both' && visitor?.detachable && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleDetach()
          }}
          className="absolute top-2 right-2 p-1 rounded bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-cyan-400 transition-colors"
          aria-label="Detach to floating panel"
          title="Detach to floating panel"
        >
          <DetachIcon />
        </button>
      )}
    </Card>
  )
}

export default InteractiveCard
