/**
 * Actions Component
 *
 * Level 2: Container for action-related overlays and menus.
 *
 * @module file-browser/components/Actions
 */

import { memo, useState, useCallback, type ReactNode, type MouseEvent } from 'react'

import { useFileBrowserContext } from '../FileBrowser/context'
import { DARK_SIDE } from '../../tokens'
import { ContextMenu, createFileContextActions, type ContextMenuAction } from './ContextMenu'
import { OperationOverlay, type OperationProgress } from './OperationOverlay'
import { DrillDownOverlay } from './DrillDownOverlay'

// =============================================================================
// Types
// =============================================================================

export interface ActionsProps {
  /** Active operations */
  operations?: OperationProgress[]
  /** Called when operation cancelled */
  onCancelOperation?: (operationId: string) => void
  /** Called when operation dismissed */
  onDismissOperation?: (operationId: string) => void
  /** Override children (render custom content) */
  children?: ReactNode
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

const ActionsRoot = memo(function Actions({
  operations = [],
  onCancelOperation,
  onDismissOperation,
  children,
  className = '',
}: ActionsProps) {
  const {
    selectedFiles,
    focusedFile,
    entries,
    copy,
    cut,
    paste,
    deleteSelected,
    createDirectory,
    refresh,
    setShowHidden,
    showHidden,
  } = useFileBrowserContext()

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  // Drill down state
  const [drillDownEntry, setDrillDownEntry] = useState<(typeof entries)[0] | null>(null)

  // Handle context menu
  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // Handle inspect action (opens drill down)
  const handleInspect = useCallback(() => {
    if (focusedFile) {
      const entry = entries.find((e) => e.id === focusedFile)
      if (entry) {
        setDrillDownEntry(entry)
      }
    }
  }, [focusedFile, entries])

  // Close drill down
  const closeDrillDown = useCallback(() => {
    setDrillDownEntry(null)
  }, [])

  // Handle new folder
  const handleNewFolder = useCallback(() => {
    const name = window.prompt('Enter folder name:')
    if (name) {
      createDirectory(name)
    }
  }, [createDirectory])

  // Create context actions
  const contextActions = createFileContextActions({
    hasSelection: selectedFiles.size > 0,
    hasClipboard: false, // TODO: Track clipboard state
    canPaste: false, // TODO: Track clipboard state
    onCopy: copy,
    onCut: cut,
    onPaste: paste,
    onDelete: deleteSelected,
    onNewFolder: handleNewFolder,
    onRename: undefined, // TODO: Implement rename
    onRefresh: refresh,
    onToggleHidden: () => setShowHidden(!showHidden),
    onInspect: handleInspect,
  })

  return (
    <div
      className={`file-browser-actions ${className}`}
      style={{ position: 'relative' }}
      onContextMenu={handleContextMenu}
      data-file-browser-actions
    >
      {children}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextActions}
          onClose={closeContextMenu}
        />
      )}

      {/* Operation Overlay */}
      <OperationOverlay
        operations={operations}
        onCancel={onCancelOperation}
        onDismiss={onDismissOperation}
      />

      {/* Drill Down Overlay */}
      {drillDownEntry && (
        <DrillDownOverlay
          entry={drillDownEntry}
          onClose={closeDrillDown}
          analysisText={[
            'INITIALIZING DEEP SCAN...',
            'ANALYZING FILE STRUCTURE...',
            'COMPUTING HASH SIGNATURES...',
            'SCAN COMPLETE',
          ]}
        />
      )}
    </div>
  )
})

// =============================================================================
// Compound Export
// =============================================================================

export const Actions = Object.assign(ActionsRoot, {
  ContextMenu,
  OperationOverlay,
  DrillDown: DrillDownOverlay,
})
