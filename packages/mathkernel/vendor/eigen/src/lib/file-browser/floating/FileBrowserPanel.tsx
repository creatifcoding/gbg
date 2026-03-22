/**
 * FileBrowserPanel Component
 *
 * Floating panel wrapper for the FileBrowser component.
 * Registers with the FloatingPanelProvider.
 *
 * @module file-browser/floating
 */

import { memo, useEffect } from 'react'

import { useFloatingPanel } from '@/lib/floating/hooks/useFloatingPanel'
import { FileBrowser } from '../components'
import { DARK_SIDE } from '../tokens'

// =============================================================================
// Constants
// =============================================================================

export const FILE_BROWSER_PANEL_ID = 'file-browser-panel'

const DEFAULT_POSITION = { x: 100, y: 100 }
const DEFAULT_DIMENSIONS = { width: 900, height: 600 }
const MIN_DIMENSIONS = { minWidth: 600, minHeight: 400 }

// =============================================================================
// Types
// =============================================================================

export interface FileBrowserPanelProps {
  /** Initial path to navigate to */
  initialPath?: string
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

export const FileBrowserPanel = memo(function FileBrowserPanel({
  initialPath = '/',
  className = '',
}: FileBrowserPanelProps) {
  const { registerPanel, panels } = useFloatingPanel()

  // Check if panel already exists
  const panelExists = panels.some((p) => p.id === FILE_BROWSER_PANEL_ID)

  // Register panel on mount
  useEffect(() => {
    if (!panelExists) {
      registerPanel({
        id: FILE_BROWSER_PANEL_ID,
        title: 'FILE_BROWSER',
        mode: 'floating',
        initialPosition: DEFAULT_POSITION,
        initialDimensions: DEFAULT_DIMENSIONS,
        constraints: MIN_DIMENSIONS,
        closable: true,
        minimizable: true,
        resizable: true,
      })
    }
  }, [registerPanel, panelExists])

  return (
    <div
      className={`file-browser-panel ${className}`}
      style={{
        width: '100%',
        height: '100%',
        background: DARK_SIDE.colors.background,
        overflow: 'hidden',
      }}
    >
      <FileBrowser initialPath={initialPath}>
        <FileBrowser.Header>
          <FileBrowser.Header.Breadcrumb />
          <FileBrowser.Header.Actions />
        </FileBrowser.Header>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <FileBrowser.Content />
          <FileBrowser.Inspector />
        </div>
      </FileBrowser>
    </div>
  )
})
