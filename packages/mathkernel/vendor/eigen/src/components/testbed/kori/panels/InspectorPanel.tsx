/**
 * KORI ECS Inspector Panel
 *
 * AG-Grid based entity inspector with live updates.
 * Columns: entityId, traits[], actorId, health, position.
 *
 * Features:
 * - Click entity row to select
 * - Click entity ID or copy icon to copy to clipboard
 *
 * @module
 */

import { useMemo, useCallback, useEffect, useState } from "react"
import type { ColDef, ICellRendererParams, RowClickedEvent } from "ag-grid-community"

import { useStxData, useStx } from "@/lib/stx"
import { TmnlDataGrid, tmnlDenseDark, type GridVariantType } from "@/lib/data-grid"
import { useSelection, type SelectionMode } from "@/lib/selection"
import {
  getKoriTestbedStx,
  type EntityDisplay,
} from "../kori-testbed-stx"

// =============================================================================
// Copy to Clipboard Utility
// =============================================================================

/**
 * Copy text to clipboard with visual feedback
 * Returns true if successful
 */
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement("textarea")
    textArea.value = text
    textArea.style.position = "fixed"
    textArea.style.left = "-999999px"
    document.body.appendChild(textArea)
    textArea.select()
    const success = document.execCommand("copy")
    document.body.removeChild(textArea)
    return success
  }
}

/**
 * Copy icon component
 */
const CopyIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

/**
 * Check icon for copy feedback
 */
const CheckIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

// =============================================================================
// Cell Renderers
// =============================================================================

/**
 * Clickable ID cell with copy-to-clipboard
 * Uses a wrapper component for useState hook
 */
const IdCellRendererComponent = ({
  id,
  variant,
}: {
  id: string
  variant: GridVariantType
}) => {
  const [copied, setCopied] = useState(false)
  const short = id?.slice(0, 8) ?? ""

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation() // Don't trigger row click
      if (!id) return
      const success = await copyToClipboard(id)
      if (success) {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    },
    [id]
  )

  return (
    <div
      className="flex items-center gap-1 cursor-pointer group"
      onClick={handleCopy}
      title={`Click to copy: ${id}`}
    >
      <span
        style={{
          fontFamily: "monospace",
          color: variant.colors?.text?.muted ?? "#666",
          fontSize: variant.density?.fontSizeXs ?? "10px",
        }}
      >
        {short}...
      </span>
      <span
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: copied ? "#22c55e" : "#22d3ee" }}
      >
        {copied ? <CheckIcon size={10} /> : <CopyIcon size={10} />}
      </span>
    </div>
  )
}

const IdCellRenderer = (
  params: ICellRendererParams<EntityDisplay>,
  variant: GridVariantType
) => {
  const id = params.value as string
  return <IdCellRendererComponent id={id} variant={variant} />
}

/**
 * Clickable entity ID for selected entity details
 * Shows full ID with copy button
 */
const ClickableEntityId = ({
  id,
  className = "",
}: {
  id: string
  className?: string
}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!id) return
    const success = await copyToClipboard(id)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }, [id])

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 font-mono text-cyan-400 hover:text-cyan-300 transition-colors group ${className}`}
      style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
      title="Click to copy entity ID"
    >
      <span>{id}</span>
      <span
        className="opacity-50 group-hover:opacity-100 transition-opacity"
        style={{ color: copied ? "#22c55e" : "currentColor" }}
      >
        {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
      </span>
      {copied && (
        <span
          className="text-green-400"
          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
        >
          Copied!
        </span>
      )}
    </button>
  )
}

const TraitsCellRenderer = (
  params: ICellRendererParams<EntityDisplay>,
  variant: GridVariantType
) => {
  const traits = params.value as string[] | undefined
  if (!traits || !Array.isArray(traits) || traits.length === 0) {
    return <span style={{ color: variant.colors?.text?.muted ?? "#666" }}>-</span>
  }
  return (
    <div className="flex gap-1 flex-wrap">
      {traits.map((t) => (
        <span
          key={t}
          className="px-1 rounded"
          style={{
            backgroundColor: variant.colors?.surface?.s2 ?? "#1a1a1a",
            color: variant.colors?.signal?.accent ?? "#22d3ee",
            fontSize: "10px",
            fontFamily: "monospace",
          }}
        >
          {t}
        </span>
      ))}
    </div>
  )
}

const HealthCellRenderer = (
  params: ICellRendererParams<EntityDisplay>,
  variant: GridVariantType
) => {
  const health = params.data?.health
  if (!health) return <span style={{ color: variant.colors?.text?.muted ?? "#666" }}>-</span>

  const pct = (health.current / health.max) * 100
  const color =
    pct > 60
      ? variant.colors?.signal?.success ?? "#22c55e"
      : pct > 30
      ? variant.colors?.signal?.warning ?? "#eab308"
      : variant.colors?.signal?.error ?? "#ef4444"

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 rounded-full flex-1"
        style={{ backgroundColor: variant.colors?.surface?.s2 ?? "#1a1a1a" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span
        style={{
          fontFamily: "monospace",
          color: variant.colors?.text?.secondary ?? "#9ca3af",
          fontSize: variant.density?.fontSizeXs ?? "10px",
          minWidth: "40px",
          textAlign: "right",
        }}
      >
        {health.current}/{health.max}
      </span>
    </div>
  )
}

const PositionCellRenderer = (
  params: ICellRendererParams<EntityDisplay>,
  variant: GridVariantType
) => {
  const pos = params.data?.position
  if (!pos) return <span style={{ color: variant.colors?.text?.muted ?? "#666" }}>-</span>

  const hasZ = pos.z !== undefined

  return (
    <span
      style={{
        fontFamily: "monospace",
        color: variant.colors?.text?.secondary ?? "#9ca3af",
        fontSize: variant.density?.fontSizeXs ?? "10px",
      }}
    >
      {hasZ
        ? `(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z!.toFixed(1)})`
        : `(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`}
    </span>
  )
}

// =============================================================================
// Column Definitions
// =============================================================================

const createColumnDefs = (variant: GridVariantType): ColDef<EntityDisplay>[] => [
  {
    field: "id",
    headerName: "Entity",
    width: 100,
    cellRenderer: (params: ICellRendererParams<EntityDisplay>) =>
      IdCellRenderer(params, variant),
  },
  {
    field: "traits",
    headerName: "Traits",
    flex: 1,
    minWidth: 150,
    cellRenderer: (params: ICellRendererParams<EntityDisplay>) =>
      TraitsCellRenderer(params, variant),
  },
  {
    field: "health",
    headerName: "Health",
    width: 140,
    cellRenderer: (params: ICellRendererParams<EntityDisplay>) =>
      HealthCellRenderer(params, variant),
  },
  {
    field: "position",
    headerName: "Position",
    width: 140,
    cellRenderer: (params: ICellRendererParams<EntityDisplay>) =>
      PositionCellRenderer(params, variant),
  },
  {
    field: "name",
    headerName: "Name",
    width: 100,
    cellStyle: {
      color: variant.colors?.text?.primary ?? "#e5e5e5",
      fontFamily: "monospace",
      fontSize: variant.density?.fontSizeXs ?? "10px",
    },
  },
]

// =============================================================================
// Component
// =============================================================================

export function InspectorPanel() {
  const testbed = getKoriTestbedStx()
  const { runEffect } = useStx(testbed)
  const variant = tmnlDenseDark

  const entities = useStxData(testbed, (d) => d.entities.get())

  // Use selection subsystem for reactive updates
  // (stx effects handle mutations to keep selection + stx in sync)
  const { selectedIds: selectedIdsSet } = useSelection()

  // Convert Set to Array for convenience
  const selectedIds = useMemo(() => Array.from(selectedIdsSet), [selectedIdsSet])

  const columnDefs = useMemo(() => createColumnDefs(variant), [variant])

  // Auto-refresh every 500ms for reactivity
  useEffect(() => {
    const interval = setInterval(() => {
      runEffect("refreshEntities")
    }, 500)
    return () => clearInterval(interval)
  }, [runEffect])

  /**
   * Handle row click with multi-select support
   * - Click: replace selection
   * - Shift+Click: add to selection
   * - Ctrl/Cmd+Click: toggle selection
   *
   * Uses stx effects to ensure selection subsystem AND stx state stay in sync.
   * This is critical for REPL <sel> tags to work correctly.
   */
  const handleRowClick = useCallback(
    (event: RowClickedEvent<EntityDisplay>) => {
      if (!event.data) return

      const nativeEvent = event.event as MouseEvent | undefined
      let mode: SelectionMode = "replace"

      if (nativeEvent?.shiftKey) {
        mode = "add"
      } else if (nativeEvent?.ctrlKey || nativeEvent?.metaKey) {
        mode = "toggle"
      }

      // Use stx effect to sync both selection subsystem AND stx state
      runEffect("selectEntity", event.data.id, mode)
    },
    [runEffect]
  )

  const handleRefresh = useCallback(() => {
    runEffect("refreshEntities")
  }, [runEffect])

  const handleDeselectAll = useCallback(() => {
    // Use stx effect to sync both selection subsystem AND stx state
    runEffect("deselectAllEntities")
  }, [runEffect])

  // Get selected entities for display
  const selectedEntities = entities.filter((e) => selectedIds.includes(e.id))
  const selectedEntity = selectedEntities[0] ?? null

  // Row class callback for selected rows
  const getRowClass = useCallback(
    (params: { data: EntityDisplay | undefined }) => {
      if (params.data && selectedIds.includes(params.data.id)) {
        return "bg-cyan-900/30"
      }
      return ""
    },
    [selectedIds]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-neutral-400"
            style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
          >
            ENTITIES ({entities.length})
          </span>
          {selectedIds.length > 0 && (
            <span
              className="font-mono text-cyan-400"
              style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
            >
              • {selectedIds.length} selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selectedIds.length > 0 && (
            <button
              onClick={handleDeselectAll}
              className="px-2 py-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50 rounded font-mono"
              style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
              title="Deselect all (Escape)"
            >
              Clear
            </button>
          )}
          <button
            onClick={handleRefresh}
            className="px-2 py-1 text-cyan-400 hover:bg-cyan-400/10 rounded font-mono"
            style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0 border-b border-neutral-800">
        <TmnlDataGrid<EntityDisplay>
          variant={variant}
          rowData={entities as EntityDisplay[]}
          columnDefs={columnDefs}
          defaultColDef={{ resizable: true, sortable: true }}
          getRowId={(params) => params.data.id}
          rowSelection="multiple"
          onRowClicked={handleRowClick}
          getRowClass={getRowClass}
          className="h-full"
        />
      </div>

      {/* Selected Entity Details */}
      <div
        className="p-2 bg-neutral-900/50 overflow-y-auto"
        style={{ minHeight: 60, maxHeight: 120 }}
      >
        {selectedEntities.length > 0 ? (
          <div className="space-y-2">
            {/* Multi-select summary */}
            {selectedEntities.length > 1 && (
              <div
                className="text-neutral-400 font-mono pb-1 border-b border-neutral-800"
                style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
              >
                {selectedEntities.length} entities selected — use <span className="text-cyan-400">&lt;sels&gt;</span> in REPL
              </div>
            )}

            {/* Show each selected entity */}
            {selectedEntities.map((entity, idx) => (
              <div key={entity.id} className="space-y-0.5">
                <div className="flex items-center gap-2">
                  {selectedEntities.length > 1 && (
                    <span
                      className="text-neutral-600 font-mono"
                      style={{ fontSize: "10px" }}
                    >
                      {idx + 1}.
                    </span>
                  )}
                  <ClickableEntityId id={entity.id} />
                  {entity.name && (
                    <span
                      className="text-neutral-400 font-mono"
                      style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
                    >
                      ({entity.name})
                    </span>
                  )}
                </div>
                {selectedEntities.length === 1 && (
                  <div className="flex gap-1 flex-wrap ml-4">
                    {entity.traits.map((t) => (
                      <span
                        key={t}
                        className="px-1 rounded"
                        style={{
                          backgroundColor: variant.colors?.surface?.s2 ?? "#1a1a1a",
                          color: variant.colors?.signal?.accent ?? "#22d3ee",
                          fontSize: "10px",
                          fontFamily: "monospace",
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div
            className="text-neutral-600 text-center"
            style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
          >
            Click to select • Shift+Click to add • Ctrl+Click to toggle
          </div>
        )}
      </div>
    </div>
  )
}
