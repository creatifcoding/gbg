/**
 * PanelContext — per-panel compound component context
 *
 * Every FloatingPanel wraps its children in this context.
 * Compound atoms (Header, Title, Controls, Content, Resize)
 * read from here with zero props.
 *
 * Shape follows Vercel composition pattern: { state, actions, meta }
 *
 * @module
 */

import { createContext, useContext } from 'react'
import type { Position, Dimensions, DimensionConstraints, PanelVisibility } from '../types'

// =============================================================================
// State — observable panel data
// =============================================================================

export interface PanelContextState {
  readonly position: Position
  readonly dimensions: Dimensions
  readonly constraints: DimensionConstraints | undefined
  readonly zIndex: number | undefined
  readonly visibility: PanelVisibility | undefined
  readonly isDragging: boolean
  readonly isResizing: boolean
  readonly isMaximized: boolean
  readonly mode: string | undefined
  readonly closable: boolean
  readonly minimizable: boolean
  readonly resizable: boolean
}

// =============================================================================
// Actions — panel mutations
// =============================================================================

export interface PanelContextActions {
  readonly close: () => void
  readonly minimize: () => void
  readonly toggleMode: () => void
  readonly maximizeToggle: () => void
  readonly bringToFront: () => void
}

// =============================================================================
// Meta — refs, dnd handles, derived values
// =============================================================================

export interface PanelContextMeta {
  readonly id: string
  readonly title: string
  readonly borderColor: string
  /** dnd-kit: ref for the draggable node */
  readonly setNodeRef: (node: HTMLElement | null) => void
  /** dnd-kit: ref for the drag activator (header) */
  readonly setActivatorNodeRef: (node: HTMLElement | null) => void
  /** dnd-kit: listener props for drag handle */
  readonly listeners: Record<string, any> | undefined
  /** dnd-kit: spread attributes */
  readonly attributes: Record<string, any>
  /** dnd-kit: CSS transform string during drag */
  readonly dndTransform: string | undefined
}

// =============================================================================
// Combined
// =============================================================================

export interface PanelContextValue {
  readonly state: PanelContextState
  readonly actions: PanelContextActions
  readonly meta: PanelContextMeta
}

// =============================================================================
// Context + Hook
// =============================================================================

export const PanelContext = createContext<PanelContextValue | null>(null)

export function usePanelContext(): PanelContextValue {
  const ctx = useContext(PanelContext)
  if (!ctx) {
    throw new Error(
      'usePanelContext must be used within a <FloatingPanel>. ' +
      'Compound components (Header, Content, etc.) require the panel context.'
    )
  }
  return ctx
}
