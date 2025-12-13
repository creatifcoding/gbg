/**
 * FloatingPanel v2
 *
 * Draggable, resizable floating panel with window chrome.
 * Uses stx for state, @dnd-kit for drag, custom handles for resize.
 *
 * IMPORTANT: Panel must be registered in stx BEFORE rendering this component.
 * Use `registerPanel()` from floating-stx before rendering <FloatingPanel>.
 * This component is a pure consumer - it does NOT self-register.
 *
 * Key fixes from v1:
 * - Motion blur during drag (panel stays visible)
 * - Resize handles (8 directions)
 * - Dock button + double-click title bar toggle
 * - FloatingDimensionContext for content adaptation
 *
 * @pattern stx consumer (no self-registration)
 * @module
 */

import { useState, useEffect, type ReactNode } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

import { useSelector } from '@/lib/stx'
import { COLORS } from '@/lib/capabilities/tokens'
import { useFloatingPanelContext } from './FloatingPanelProvider'
import { getFloatingStx, maximizePanel, restorePanel } from './floating-stx'
import { ResizeHandles } from './ResizeHandles'
import { FloatingDimensionProvider } from './FloatingDimensionContext'
import type { PanelState, Position, Dimensions } from './types'

// =============================================================================
// Icons
// =============================================================================

function MinimizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      <rect x="1" y="4" width="8" height="2" rx="0.5" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function GripIcon() {
  return (
    <svg width="6" height="10" viewBox="0 0 6 10" fill="currentColor">
      <circle cx="1.5" cy="1.5" r="1" />
      <circle cx="4.5" cy="1.5" r="1" />
      <circle cx="1.5" cy="5" r="1" />
      <circle cx="4.5" cy="5" r="1" />
      <circle cx="1.5" cy="8.5" r="1" />
      <circle cx="4.5" cy="8.5" r="1" />
    </svg>
  )
}

function DockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="1" y="1" width="8" height="8" rx="1" />
      <line x1="1" y1="4" x2="9" y2="4" />
    </svg>
  )
}

function UndockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="1" y="3" width="6" height="6" rx="1" />
      <path d="M4 3V2a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H8" />
    </svg>
  )
}

function MaximizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="1" y="1" width="8" height="8" rx="1" />
    </svg>
  )
}

function RestoreIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
      {/* Back window */}
      <rect x="2" y="3" width="5" height="5" rx="0.5" />
      {/* Front window offset */}
      <path d="M4 3V2a0.5 0.5 0 01.5-.5h4a0.5 0.5 0 01.5.5v4a0.5 0.5 0 01-.5.5H8" />
    </svg>
  )
}

// =============================================================================
// Props
// =============================================================================

export interface FloatingPanelProps {
  /** Panel ID - must already be registered in stx */
  id: string
  /** Panel title for display */
  title: string
  /** Children to render inside panel */
  children: ReactNode
  /** Callback when close button clicked */
  onClose?: () => void
  /** Callback when dock/undock toggled */
  onToggleMode?: () => void
  /** Additional className for panel */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

/**
 * A draggable, resizable floating panel with window chrome.
 *
 * IMPORTANT: Panel must be registered in stx BEFORE rendering.
 * This component is a pure consumer - it does NOT self-register.
 *
 * @example
 * ```tsx
 * // Register first, then render
 * useEffect(() => {
 *   registerPanel({ id: 'settings', title: 'Settings', ... })
 *   return () => unregisterPanel('settings')
 * }, [])
 *
 * // Only render when panel exists
 * const panel = getPanel('settings')
 * if (!panel) return null
 *
 * return (
 *   <FloatingPanelProvider>
 *     <FloatingPanel id="settings" title="Settings">
 *       <SettingsContent />
 *     </FloatingPanel>
 *   </FloatingPanelProvider>
 * )
 * ```
 */
export function FloatingPanel({
  id,
  title,
  onClose,
  onToggleMode,
  children,
  className = '',
}: FloatingPanelProps) {
  const context = useFloatingPanelContext()
  const stx = getFloatingStx()

  // Animation state for maximize/restore transition (Apple-style subtle)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'lift' | 'settle'>('idle')

  // Subscribe to this panel's state from stx
  // NOTE: We select the full Map and extract panel to ensure safe initialization
  const panelsMap = useSelector(stx.data.panels, (p) => p)
  const panel = panelsMap?.get(id)

  // @dnd-kit draggable (transform only - drag state comes from stx)
  // Disable dragging when maximized
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
  } = useDraggable({ id, disabled: panel?.isMaximized })

  // Panel must exist in stx - if not, don't render
  // Caller is responsible for registering before rendering
  if (!panel) {
    return null
  }

  // Don't render if panel is hidden
  if (panel.visibility === 'hidden') {
    return null
  }

  // Transform style from @dnd-kit (only when not maximized)
  const transformStyle = !panel.isMaximized && transform
    ? CSS.Transform.toString(transform)
    : undefined

  // Motion blur based on drag velocity (magnitude of transform delta)
  // Uses panel.isDragging from stx (set by provider on drag start/end)
  const motionBlur = panel.isDragging && transform
    ? Math.min(Math.sqrt(transform.x ** 2 + transform.y ** 2) * 0.05, 4)
    : 0

  // Apple-style animation: subtle scale lift during transition
  const animationScale = animationPhase === 'lift' ? 0.98 : 1.0

  // Handle close
  const handleClose = () => {
    context.closePanel(id)
    onClose?.()
  }

  // Handle minimize
  const handleMinimize = () => {
    context.setVisibility(id, panel.visibility === 'minimized' ? 'visible' : 'minimized')
  }

  // Handle dock/undock toggle
  const handleToggleMode = () => {
    context.toggleMode(id)
    onToggleMode?.()
  }

  // Handle maximize with animation (Apple-style: lift → expand → settle)
  const handleMaximize = () => {
    if (panel.isMaximized || isAnimating) return

    setIsAnimating(true)
    setAnimationPhase('lift')

    // Phase 1: Lift (subtle scale down, 80ms)
    setTimeout(() => {
      setAnimationPhase('settle')
      maximizePanel(id)

      // Phase 2: Settle (smooth expansion, 200ms)
      setTimeout(() => {
        setAnimationPhase('idle')
        setIsAnimating(false)
      }, 200)
    }, 80)
  }

  // Handle restore with animation (Apple-style: lift → contract → settle)
  const handleRestore = () => {
    if (!panel.isMaximized || isAnimating) return

    setIsAnimating(true)
    setAnimationPhase('lift')

    // Phase 1: Lift (subtle scale down, 80ms)
    setTimeout(() => {
      setAnimationPhase('settle')
      restorePanel(id)

      // Phase 2: Settle (smooth contraction, 200ms)
      setTimeout(() => {
        setAnimationPhase('idle')
        setIsAnimating(false)
      }, 200)
    }, 80)
  }

  // Handle double-click title bar to maximize
  const handleTitleDoubleClick = () => {
    if (panel.isMaximized) {
      handleRestore()
    } else {
      handleMaximize()
    }
  }

  // Handle click to bring to front
  const handlePanelClick = () => {
    context.bringToFront(id)
  }

  // Handle resize end
  const handleResizeEnd = (dimensions: Dimensions, position: Position) => {
    context.updateDimensions(id, dimensions)
    context.updatePosition(id, position)
  }

  // Apple-style: subtle shadow elevation during lift phase
  const liftShadow = animationPhase === 'lift'
    ? '0 12px 40px rgba(0, 0, 0, 0.6)'
    : panel.isDragging
      ? '0 8px 32px rgba(0, 0, 0, 0.7)'
      : '0 4px 24px rgba(0, 0, 0, 0.5)'

  return (
    <div
      ref={setNodeRef}
      className={`fixed ${panel.isMaximized ? '' : 'rounded'} ${className}`}
      style={{
        left: panel.position.x,
        top: panel.position.y,
        // EXPLICIT width + height — panel dimensions are authoritative, not content
        width: panel.dimensions.width,
        height: panel.dimensions.height,
        minWidth: panel.isMaximized ? undefined : (panel.constraints?.minWidth ?? 200),
        minHeight: panel.isMaximized ? undefined : (panel.constraints?.minHeight ?? 100),
        zIndex: panel.isMaximized ? 99999 : panel.zIndex,
        // Apple-style: combine drag transform with animation scale
        transform: [
          transformStyle,
          animationScale !== 1.0 ? `scale(${animationScale})` : '',
        ].filter(Boolean).join(' ') || undefined,
        backgroundColor: COLORS.neutral[950],
        opacity: 1,
        border: panel.isMaximized ? 'none' : `1px solid ${COLORS.neutral[800]}`,
        // Apple-style shadow: elevated during lift, normal otherwise
        boxShadow: panel.isMaximized ? 'none' : liftShadow,
        // Subtle motion blur during fast drag (no harsh filters)
        filter: motionBlur > 0 ? `blur(${motionBlur}px)` : undefined,
        // Apple-style smooth transitions
        // NOTE: No transform transition when idle — prevents elastic snap-back on drag end
        transition: isAnimating
          ? 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1), top 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.08s ease-out, box-shadow 0.15s ease-out'
          : panel.isDragging
            ? 'none'
            : 'box-shadow 0.2s ease-out',
        // Flex column layout for proper height distribution
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={handlePanelClick}
      {...attributes}
    >
      {/* Title Bar - fixed height, no shrink */}
      <div
        className="flex items-center justify-between px-2 py-1.5 border-b select-none"
        style={{
          backgroundColor: COLORS.neutral[900],
          borderColor: COLORS.neutral[800],
          flexShrink: 0,
        }}
        onDoubleClick={handleTitleDoubleClick}
      >
        {/* Drag Handle + Title */}
        <div
          ref={setActivatorNodeRef}
          className="flex items-center gap-2 cursor-grab active:cursor-grabbing flex-1"
          {...listeners}
        >
          <span style={{ color: COLORS.neutral[600] }}>
            <GripIcon />
          </span>
          <span
            className="font-mono truncate"
            style={{
              fontSize: 'var(--tmnl-text-xs, 12px)',
              color: COLORS.neutral[400],
            }}
          >
            {title}
          </span>
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1">
          {/* Dock/Undock toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleToggleMode()
            }}
            className="p-1 rounded transition-colors hover:bg-white/10"
            style={{ color: COLORS.neutral[500] }}
            aria-label={panel.mode === 'floating' ? 'Dock panel' : 'Undock panel'}
            title={panel.mode === 'floating' ? 'Dock panel' : 'Float panel'}
          >
            {panel.mode === 'floating' ? <DockIcon /> : <UndockIcon />}
          </button>

          {/* Maximize/Restore toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (panel.isMaximized) {
                handleRestore()
              } else {
                handleMaximize()
              }
            }}
            className="p-1 rounded transition-colors hover:bg-white/10"
            style={{ color: COLORS.neutral[500] }}
            aria-label={panel.isMaximized ? 'Restore panel' : 'Maximize panel'}
            title={panel.isMaximized ? 'Restore' : 'Maximize'}
          >
            {panel.isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
          </button>

          {panel.minimizable && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleMinimize()
              }}
              className="p-1 rounded transition-colors hover:bg-white/10"
              style={{ color: COLORS.neutral[500] }}
              aria-label="Minimize"
            >
              <MinimizeIcon />
            </button>
          )}

          {panel.closable && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleClose()
              }}
              className="p-1 rounded transition-colors hover:bg-red-500/20 hover:text-red-400"
              style={{ color: COLORS.neutral[500] }}
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      {/* Content (collapsed when minimized) - fills remaining space */}
      {panel.visibility !== 'minimized' && (
        <FloatingDimensionProvider
          panelId={id}
          dimensions={panel.dimensions}
          isResizing={panel.isResizing}
        >
          <div
            className="overflow-auto"
            style={{
              // flex: 1 fills remaining height, min-height: 0 allows shrinking below content size
              flex: 1,
              minHeight: 0,
              minWidth: 0,
            }}
          >
            {children}
          </div>
        </FloatingDimensionProvider>
      )}

      {/* Resize Handles - wrapped in absolute container for proper positioning */}
      {panel.resizable && panel.visibility !== 'minimized' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          }}
        >
          <ResizeHandles
            panelId={id}
            dimensions={panel.dimensions}
            position={panel.position}
            onResizeEnd={handleResizeEnd}
          />
        </div>
      )}
    </div>
  )
}

export default FloatingPanel
