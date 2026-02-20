/**
 * FloatingPanel v5 — Compound decomposition
 *
 * Zero animation. dnd-kit owns drag transform. stx owns state.
 * Header, content, resize handles are separate components.
 *
 * @module
 */

import { useCallback, memo, type ReactNode } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

import { useSelector } from '@/lib/stx'
import { useFloatingPanelContext } from './context/FloatingPanelContext'
import { getFloatingStx, maximizePanel, restorePanel } from './floating-stx'
import { ResizeHandles } from './ResizeHandles'
import { PANEL } from './tokens'
import { PanelHeader } from './components/PanelHeader'
import { PanelContent } from './components/PanelContent'

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
// Component
// =============================================================================

export const FloatingPanel = memo(function FloatingPanel({
  id, title, onClose: onCloseProp, onToggleMode: onToggleModeProp, children, className = '',
}: FloatingPanelProps) {
  const context = useFloatingPanelContext()

  // ─── Fine-grained field selectors ────────────────────────────
  const stxPanel = getFloatingStx().data.panels.get(id)
  const position = useSelector(() => stxPanel?.position.get())
  const dimensions = useSelector(() => stxPanel?.dimensions.get())
  const constraints = useSelector(() => stxPanel?.constraints.get())
  const zIndex = useSelector(() => stxPanel?.zIndex.get())
  const visibility = useSelector(() => stxPanel?.visibility.get())
  const isDragging = useSelector(() => stxPanel?.isDragging.get() ?? false)
  const isResizing = useSelector(() => stxPanel?.isResizing.get() ?? false)
  const isMaximized = useSelector(() => stxPanel?.isMaximized.get() ?? false)
  const mode = useSelector(() => stxPanel?.mode.get())
  const closable = useSelector(() => stxPanel?.closable.get() ?? true)
  const minimizable = useSelector(() => stxPanel?.minimizable.get() ?? true)
  const resizable = useSelector(() => stxPanel?.resizable.get() ?? true)

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform } = useDraggable({ id, disabled: isMaximized })

  if (!position || !dimensions) return null
  if (visibility === 'hidden') return null

  const dndTransform = !isMaximized && transform ? CSS.Translate.toString(transform) : undefined

  // ─── Handlers ────────────────────────────────────────────────
  const handleClose = useCallback(() => { context.closePanel(id); onCloseProp?.() }, [context, id, onCloseProp])
  const handleMinimize = useCallback(() => { context.setVisibility(id, visibility === 'minimized' ? 'visible' : 'minimized') }, [context, id, visibility])
  const handleToggleMode = useCallback(() => { context.toggleMode(id); onToggleModeProp?.() }, [context, id, onToggleModeProp])
  const handleMaximizeToggle = useCallback(() => { isMaximized ? restorePanel(id) : maximizePanel(id) }, [id, isMaximized])
  const handlePanelClick = useCallback(() => { context.bringToFront(id) }, [context, id])

  const borderColor = (isDragging || isResizing) ? PANEL.borderActive : PANEL.border

  return (
    <div
      ref={setNodeRef}
      role="dialog"
      aria-label={title}
      className={`fp-panel ${className}`.trim()}
      data-floating-panel
      data-state={isDragging ? 'dragging' : isResizing ? 'resizing' : isMaximized ? 'maximized' : 'idle'}
      style={{
        position: 'fixed',
        left: position.x, top: position.y,
        width: dimensions.width, height: dimensions.height,
        minWidth: isMaximized ? undefined : (constraints?.minWidth ?? 220),
        minHeight: isMaximized ? undefined : (constraints?.minHeight ?? 120),
        zIndex: isMaximized ? 99999 : zIndex,
        boxShadow: 'none',
        backgroundColor: PANEL.bg,
        border: isMaximized ? 'none' : `1px solid ${borderColor}`,
        borderRadius: isMaximized ? 0 : PANEL.radius,
        overflow: 'hidden',
        transform: dndTransform,
        willChange: 'transform',
        display: 'flex', flexDirection: 'column' as const,
      }}
      onClick={handlePanelClick}
      {...attributes}
    >
      <PanelHeader
        title={title}
        borderColor={borderColor}
        isMaximized={isMaximized}
        mode={mode}
        closable={closable}
        minimizable={minimizable}
        onClose={handleClose}
        onMinimize={handleMinimize}
        onToggleMode={handleToggleMode}
        onMaximizeToggle={handleMaximizeToggle}
        activatorRef={setActivatorNodeRef}
        listeners={listeners}
      />

      {visibility !== 'minimized' && (
        <PanelContent panelId={id} dimensions={dimensions} isResizing={isResizing}>
          {children}
        </PanelContent>
      )}

      {resizable && visibility !== 'minimized' && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <ResizeHandles panelId={id} dimensions={dimensions} position={position} />
        </div>
      )}
    </div>
  )
})

export default FloatingPanel
