/**
 * FloatingPanel v6 — Full compound decomposition
 *
 * Every visual atom is a separate component reading from PanelContext.
 * Consumers compose any subset in any order via FloatingPanel.* namespace.
 *
 * Default render:
 *   <FloatingPanel id="x" title="X">
 *     {children}
 *   </FloatingPanel>
 *
 * Custom composition:
 *   <FloatingPanel id="x" title="X">
 *     <FloatingPanel.Header>
 *       <FloatingPanel.TitleTab />
 *       <FloatingPanel.Controls>
 *         <FloatingPanel.MaxToggle />
 *       </FloatingPanel.Controls>
 *     </FloatingPanel.Header>
 *     <FloatingPanel.Content>{children}</FloatingPanel.Content>
 *   </FloatingPanel>
 *
 * @module
 */

import { useCallback, useEffect, memo, type ReactNode } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

import { useFloatingPanelContext } from './context/FloatingPanelContext'
import { PanelContext, type PanelContextValue } from './context/PanelContext'
import { maximizePanel, restorePanel, minimizePanel } from './floating-stx'
import { MAXIMIZED_Z_INDEX } from './stx/constants'
import { usePanelState } from './hooks/usePanelState'
import { PANEL } from './tokens'

// Compound atoms
import { PanelHeader } from './components/PanelHeader'
import { PanelContent } from './components/PanelContent'
import {
  PanelTitle,
  PanelTabClose,
  PanelTitleTab,
  PanelModeToggle,
  PanelMaxToggle,
  PanelMinimize,
  PanelControls,
  PanelResize,
} from './components/atoms'

// =============================================================================
// Props
// =============================================================================

export interface FloatingPanelProps {
  id: string
  title: string
  children: ReactNode
  onClose?: () => void
  onToggleMode?: () => void
  className?: string
}

// =============================================================================
// Root Component
// =============================================================================

const FloatingPanelRoot = memo(function FloatingPanelRoot({
  id, title, onClose: onCloseProp, onToggleMode: onToggleModeProp, children, className = '',
}: FloatingPanelProps) {
  const systemCtx = useFloatingPanelContext()
  const state = usePanelState(id)

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform } = useDraggable({
    id,
    disabled: state?.isMaximized ?? false,
  })

  // ─── Escape key: always restores maximized panel ──────────────
  // Must be BEFORE any early returns — hooks run unconditionally
  useEffect(() => {
    if (!state?.isMaximized) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        restorePanel(id)
      }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [state?.isMaximized, id])

  // ─── Early returns AFTER all hooks ────────────────────────────
  if (!state) return null
  if (state.visibility === 'hidden' || state.visibility === 'minimized') return null

  const dndTransform = !state.isMaximized && transform ? CSS.Translate.toString(transform) : undefined
  const borderColor = (state.isDragging || state.isResizing) ? PANEL.borderActive : PANEL.border

  // ─── Build PanelContext value ─────────────────────────────────
  const panelCtx: PanelContextValue = {
    state,
    actions: {
      close: () => { systemCtx.closePanel(id); onCloseProp?.() },
      minimize: () => { minimizePanel(id) },
      toggleMode: () => { systemCtx.toggleMode(id); onToggleModeProp?.() },
      maximizeToggle: () => { state.isMaximized ? restorePanel(id) : maximizePanel(id) },
      bringToFront: () => { systemCtx.bringToFront(id) },
    },
    meta: {
      id,
      title,
      borderColor,
      setNodeRef,
      setActivatorNodeRef,
      listeners,
      attributes,
      dndTransform,
    },
  }

  // ─── Detect compound vs default children ──────────────────────
  // If children contain compound atoms (Header, Content), render as-is.
  // Otherwise, wrap in default Header + Content layout.
  const hasCompoundChildren = isCompoundComposition(children)

  return (
    <PanelContext.Provider value={panelCtx}>
      <div
        ref={setNodeRef}
        {...attributes}
        role="dialog"
        aria-label={title}
        aria-roledescription="floating panel"
        className={`fp-panel ${className}`.trim()}
        data-floating-panel
        data-state={state.isDragging ? 'dragging' : state.isResizing ? 'resizing' : state.isMaximized ? 'maximized' : 'idle'}
        style={{
          position: 'fixed',
          left: state.position.x, top: state.position.y,
          width: state.dimensions.width, height: state.dimensions.height,
          minWidth: state.isMaximized ? undefined : (state.constraints?.minWidth ?? 220),
          minHeight: state.isMaximized ? undefined : (state.constraints?.minHeight ?? 120),
          zIndex: state.isMaximized ? MAXIMIZED_Z_INDEX : state.zIndex,
          boxShadow: 'none',
          backgroundColor: PANEL.bg,
          border: state.isMaximized ? 'none' : `1px solid ${borderColor}`,
          borderRadius: state.isMaximized ? 0 : PANEL.radius,
          overflow: 'hidden',
          transform: dndTransform,
          willChange: 'transform',
          transition: 'none',
          display: 'flex', flexDirection: 'column' as const,
        }}
        onClick={panelCtx.actions.bringToFront}
      >
        {hasCompoundChildren ? (
          children
        ) : (
          <>
            <PanelHeader />
            <PanelContent>{children}</PanelContent>
            <PanelResize />
          </>
        )}
      </div>
    </PanelContext.Provider>
  )
})

// =============================================================================
// Compound detection
// =============================================================================

function isCompoundComposition(children: ReactNode): boolean {
  if (!children || typeof children !== 'object') return false
  const arr = Array.isArray(children) ? children : [children]
  return arr.some((child) => {
    if (!child || typeof child !== 'object' || !('type' in child)) return false
    const t = child.type
    return t === PanelHeader || t === PanelContent || t === PanelResize
  })
}

// =============================================================================
// Compound Namespace
// =============================================================================

export const FloatingPanel = Object.assign(FloatingPanelRoot, {
  Header: PanelHeader,
  Content: PanelContent,
  Resize: PanelResize,
  // Header atoms
  TitleTab: PanelTitleTab,
  Title: PanelTitle,
  TabClose: PanelTabClose,
  Controls: PanelControls,
  ModeToggle: PanelModeToggle,
  MaxToggle: PanelMaxToggle,
  Minimize: PanelMinimize,
})

export default FloatingPanel
