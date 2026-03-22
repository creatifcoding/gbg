/**
 * FileBrowserTrigger Component
 *
 * Button to open the FileBrowser floating panel.
 *
 * @module file-browser/floating
 */

import { memo, useCallback } from 'react'
import { FolderOpen } from 'lucide-react'

import { useFloatingPanel } from '@/lib/floating/hooks/useFloatingPanel'
import { DARK_SIDE } from '../tokens'
import { FILE_BROWSER_PANEL_ID } from './FileBrowserPanel'

// =============================================================================
// Types
// =============================================================================

export interface FileBrowserTriggerProps {
  /** Button label */
  label?: string
  /** Show icon */
  showIcon?: boolean
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

export const FileBrowserTrigger = memo(function FileBrowserTrigger({
  label = 'FILES',
  showIcon = true,
  className = '',
}: FileBrowserTriggerProps) {
  const { registerPanel, bringToFront, panels } = useFloatingPanel()

  // Check if panel exists
  const panel = panels.find((p) => p.id === FILE_BROWSER_PANEL_ID)

  // Handle click - register or bring to front
  const handleClick = useCallback(() => {
    if (panel) {
      // Panel exists - bring to front
      bringToFront(FILE_BROWSER_PANEL_ID)
    } else {
      // Register new panel
      registerPanel({
        id: FILE_BROWSER_PANEL_ID,
        title: 'FILE_BROWSER',
        mode: 'floating',
        initialPosition: { x: 100, y: 100 },
        initialDimensions: { width: 900, height: 600 },
        constraints: { minWidth: 600, minHeight: 400 },
        closable: true,
        minimizable: true,
        resizable: true,
      })
    }
  }, [panel, registerPanel, bringToFront])

  return (
    <button
      className={`file-browser-trigger ${className}`}
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: DARK_SIDE.spacing['2'],
        padding: `${DARK_SIDE.spacing['2']} ${DARK_SIDE.spacing['3']}`,
        background: DARK_SIDE.colors.surface,
        border: `1px solid ${DARK_SIDE.colors.border.default}`,
        color: DARK_SIDE.colors.text.secondary,
        fontSize: DARK_SIDE.typography.size.xs,
        fontFamily: DARK_SIDE.typography.family.mono,
        fontWeight: DARK_SIDE.typography.weight.bold,
        letterSpacing: DARK_SIDE.typography.letterSpacing.wide,
        cursor: 'pointer',
        transition: `all ${DARK_SIDE.animation.duration.fast} ${DARK_SIDE.animation.easing.easeOut}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = DARK_SIDE.colors.surfaceHover
        e.currentTarget.style.borderColor = DARK_SIDE.colors.accent.green
        e.currentTarget.style.color = DARK_SIDE.colors.accent.green
        e.currentTarget.style.boxShadow = DARK_SIDE.shadows.glow.green
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = DARK_SIDE.colors.surface
        e.currentTarget.style.borderColor = DARK_SIDE.colors.border.default
        e.currentTarget.style.color = DARK_SIDE.colors.text.secondary
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {showIcon && <FolderOpen size={14} />}
      {label}
    </button>
  )
})
