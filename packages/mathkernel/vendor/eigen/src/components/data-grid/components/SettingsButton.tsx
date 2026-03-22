/**
 * DataGridSettingsButton
 *
 * Opens a drawer with VariantBuilder for per-grid variant configuration.
 * Uses TableService for persistence and drawer system for UI.
 *
 * @example
 * ```tsx
 * <DataGrid id="my-grid" rowData={data}>
 *   <DataGrid.Header>
 *     <DataGrid.Title title="EMITTERS" />
 *     <DataGrid.SettingsButton />
 *   </DataGrid.Header>
 *   <DataGrid.Body />
 * </DataGrid>
 * ```
 */

import { useCallback, useState, useEffect } from 'react'
import { Settings2 } from 'lucide-react'

import { useDataGrid } from '../DataGridContext'
import { VariantBuilder } from '../VariantBuilder'
import { useDrawer } from '@/lib/drawer'
import { useTableService, type GridId } from '@/lib/table-service'
import type { GridVariant, GridVariantPartial } from '@/lib/data-grid/schemas/variant'

// =============================================================================
// TYPES
// =============================================================================

export interface DataGridSettingsButtonProps {
  /** Custom class name */
  className?: string
}

// =============================================================================
// DRAWER CONTENT WRAPPER
// =============================================================================

interface SettingsDrawerContentProps {
  gridId: GridId
  drawerId: string
}

function SettingsDrawerContent({ gridId, drawerId }: SettingsDrawerContentProps) {
  const drawer = useDrawer()
  const {
    activeVariant,
    getVariantForGrid,
    setGridOverride,
    clearGridOverride,
    isReady,
  } = useTableService()

  // Local state for the variant being edited
  const [localVariant, setLocalVariant] = useState<GridVariant | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Load the variant for this grid on mount
  useEffect(() => {
    if (isReady) {
      getVariantForGrid(gridId).then(setLocalVariant).catch(console.error)
    }
  }, [gridId, isReady, getVariantForGrid])

  // Handle variant changes from the builder
  const handleVariantChange = useCallback(
    (updates: Partial<GridVariant>) => {
      setLocalVariant((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          ...updates,
          colors: updates.colors
            ? {
                background: { ...prev.colors.background, ...updates.colors.background },
                text: { ...prev.colors.text, ...updates.colors.text },
                signal: { ...prev.colors.signal, ...updates.colors.signal },
                border: { ...prev.colors.border, ...updates.colors.border },
                flash: updates.colors.flash ?? prev.colors.flash,
              }
            : prev.colors,
          behavior: updates.behavior
            ? {
                ...prev.behavior,
                ...updates.behavior,
                microInteractions: {
                  ...prev.behavior.microInteractions,
                  ...updates.behavior.microInteractions,
                },
                resize: { ...prev.behavior.resize, ...updates.behavior?.resize },
                sort: { ...prev.behavior.sort, ...updates.behavior?.sort },
                drag: { ...prev.behavior.drag, ...updates.behavior?.drag },
              }
            : prev.behavior,
          density: updates.density
            ? { ...prev.density, ...updates.density }
            : prev.density,
        }
      })
      setHasChanges(true)
    },
    []
  )

  // Save changes
  const handleSave = useCallback(async () => {
    if (!localVariant) return

    // Create overrides from the difference between localVariant and activeVariant
    const overrides: GridVariantPartial = {
      colors: localVariant.colors,
      behavior: localVariant.behavior,
      density: localVariant.density,
    }

    await setGridOverride(gridId, overrides)
    setHasChanges(false)
    drawer.close(drawerId)
  }, [gridId, localVariant, setGridOverride, drawer, drawerId])

  // Reset to base variant
  const handleReset = useCallback(async () => {
    await clearGridOverride(gridId)
    // Reload the variant
    const fresh = await getVariantForGrid(gridId)
    setLocalVariant(fresh)
    setHasChanges(false)
  }, [gridId, clearGridOverride, getVariantForGrid])

  // Cancel and close
  const handleCancel = useCallback(() => {
    drawer.close(drawerId)
  }, [drawer, drawerId])

  if (!localVariant) {
    return (
      <div className="p-4 text-neutral-500 font-mono" style={{ fontSize: 10 }}>
        Loading variant...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-neutral-800">
        <div className="font-mono uppercase tracking-widest text-neutral-300" style={{ fontSize: 11 }}>
          Grid Settings
        </div>
        <div className="font-mono text-neutral-600" style={{ fontSize: 9 }}>
          ID: {gridId}
        </div>
      </div>

      {/* Builder */}
      <div className="flex-1 overflow-y-auto p-4">
        <VariantBuilder variant={localVariant} onChange={handleVariantChange} />
      </div>

      {/* Footer with actions */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-neutral-800 flex items-center justify-between">
        <button
          onClick={handleReset}
          className="px-3 py-1.5 border border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-white transition-colors font-mono uppercase"
          style={{ fontSize: 9 }}
        >
          Reset
        </button>

        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 border border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-white transition-colors font-mono uppercase"
            style={{ fontSize: 9 }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`
              px-3 py-1.5 border transition-colors font-mono uppercase
              ${hasChanges
                ? 'border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10'
                : 'border-neutral-800 text-neutral-600 cursor-not-allowed'
              }
            `}
            style={{ fontSize: 9 }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// SETTINGS BUTTON
// =============================================================================

export function DataGridSettingsButton({ className = '' }: DataGridSettingsButtonProps) {
  const { id: gridId } = useDataGrid()
  const drawer = useDrawer()

  const drawerId = `grid-settings-${gridId}`

  const handleClick = useCallback(() => {
    drawer.open({
      id: drawerId,
      slot: 'global',
      content: <SettingsDrawerContent gridId={gridId as GridId} drawerId={drawerId} />,
      side: 'right',
      width: 320,
    })
  }, [drawer, gridId, drawerId])

  return (
    <button
      onClick={handleClick}
      className={`
        flex items-center justify-center w-6 h-6
        text-neutral-600 hover:text-white
        transition-colors
        ${className}
      `}
      aria-label="Grid settings"
    >
      <Settings2 size={12} />
    </button>
  )
}

DataGridSettingsButton.displayName = 'DataGrid.SettingsButton'
