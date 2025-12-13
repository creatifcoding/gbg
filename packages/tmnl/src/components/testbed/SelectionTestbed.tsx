/**
 * SelectionTestbed
 *
 * Interactive testbed for the marquee selection system.
 * Demonstrates drag selection, grouping, and hotkeys.
 *
 * Route: /testbed/selection
 *
 * @module
 */

import { useRef, useState, useCallback } from 'react'
import { SelectionOverlay, useSelection, useSelectable } from '@/lib/selection'
import { SelectionRing } from '@/components/affordances'
import { COLORS } from '@/lib/capabilities/tokens'

// =============================================================================
// Test Card Component
// =============================================================================

interface TestCardProps {
  id: string
  label: string
  color?: string
}

function TestCard({ id, label, color = COLORS.neutral[800] }: TestCardProps) {
  const { selectableProps, isSelected } = useSelectable(id)

  return (
    <div
      {...selectableProps}
      className="relative w-32 h-24 rounded cursor-pointer transition-transform hover:scale-[1.02]"
      style={{
        backgroundColor: color,
        border: `1px solid ${COLORS.neutral[700]}`,
      }}
    >
      <SelectionRing selected={isSelected} color="cyan" style="ring" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-mono text-neutral-400"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {label}
        </span>
      </div>
      <div
        className="absolute bottom-1 left-1 font-mono text-neutral-600"
        style={{ fontSize: '10px' }}
      >
        {id}
      </div>
    </div>
  )
}

// =============================================================================
// Selection Info Panel
// =============================================================================

function SelectionInfoPanel() {
  const { selectedIds, selectedCount, hasSelection, groups } = useSelection()

  return (
    <div
      className="absolute top-4 right-4 w-64 p-3 rounded"
      style={{
        backgroundColor: COLORS.neutral[900],
        border: `1px solid ${COLORS.neutral[800]}`,
      }}
    >
      <div className="font-mono text-neutral-400 mb-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        SELECTION INFO
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>Selected:</span>
          <span className="text-cyan-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {selectedCount}
          </span>
        </div>

        {hasSelection && (
          <div className="text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            IDs: {Array.from(selectedIds).join(', ')}
          </div>
        )}

        <div className="border-t border-neutral-800 pt-2 mt-2">
          <div className="text-neutral-500 mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Groups: {groups.size}
          </div>
          {Array.from(groups.entries()).map(([groupId, group]) => (
            <div key={groupId} className="text-neutral-600" style={{ fontSize: '10px' }}>
              {groupId}: [{group.memberIds.join(', ')}]
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Hotkey Help Panel
// =============================================================================

function HotkeyHelpPanel() {
  return (
    <div
      className="absolute bottom-4 right-4 p-3 rounded"
      style={{
        backgroundColor: COLORS.neutral[900],
        border: `1px solid ${COLORS.neutral[800]}`,
      }}
    >
      <div className="font-mono text-neutral-400 mb-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        HOTKEYS
      </div>
      <div className="space-y-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        <HotkeyRow keys="Escape" action="Deselect all" />
        <HotkeyRow keys="Ctrl+A" action="Select all" />
        <HotkeyRow keys="Shift+G" action="Group" />
        <HotkeyRow keys="Shift+U" action="Ungroup" />
        <HotkeyRow keys="Delete" action="Delete" />
        <div className="border-t border-neutral-800 pt-1 mt-1">
          <HotkeyRow keys="Shift+Click" action="Add to selection" />
          <HotkeyRow keys="Ctrl+Click" action="Toggle selection" />
          <HotkeyRow keys="Drag" action="Marquee select" />
        </div>
      </div>
    </div>
  )
}

function HotkeyRow({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-cyan-400 font-mono">{keys}</span>
      <span className="text-neutral-500">{action}</span>
    </div>
  )
}

// =============================================================================
// Main Testbed
// =============================================================================

export function SelectionTestbed() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [log, setLog] = useState<string[]>([])

  const addLog = useCallback((message: string) => {
    setLog((prev) => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`])
  }, [])

  const handleSelectionChange = useCallback(
    (ids: Set<string>) => {
      addLog(`Selection: [${Array.from(ids).join(', ')}]`)
    },
    [addLog]
  )

  const handleGroup = useCallback(
    (groupId: string, memberIds: string[]) => {
      addLog(`Grouped: ${groupId} with [${memberIds.join(', ')}]`)
    },
    [addLog]
  )

  const handleUngroup = useCallback(
    (itemIds: string[]) => {
      addLog(`Ungrouped: [${itemIds.join(', ')}]`)
    },
    [addLog]
  )

  const handleDelete = useCallback(
    (ids: string[]) => {
      setDeletedIds((prev) => [...prev, ...ids])
      addLog(`Deleted: [${ids.join(', ')}]`)
    },
    [addLog]
  )

  // Card data
  const cards = [
    { id: 'card-1', label: 'Alpha', x: 50, y: 50 },
    { id: 'card-2', label: 'Beta', x: 200, y: 50 },
    { id: 'card-3', label: 'Gamma', x: 350, y: 50 },
    { id: 'card-4', label: 'Delta', x: 50, y: 200 },
    { id: 'card-5', label: 'Epsilon', x: 200, y: 200 },
    { id: 'card-6', label: 'Zeta', x: 350, y: 200 },
    { id: 'card-7', label: 'Eta', x: 125, y: 350 },
    { id: 'card-8', label: 'Theta', x: 275, y: 350 },
  ].filter((card) => !deletedIds.includes(card.id))

  return (
    <div className="h-screen w-screen overflow-hidden" style={{ backgroundColor: COLORS.neutral[950] }}>
      {/* Header */}
      <div
        className="absolute top-0 left-0 right-0 h-12 flex items-center px-4 z-50"
        style={{
          backgroundColor: COLORS.neutral[900],
          borderBottom: `1px solid ${COLORS.neutral[800]}`,
        }}
      >
        <div className="font-mono text-neutral-400" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
          SELECTION TESTBED
        </div>
        <div className="ml-4 text-neutral-600" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          Drag to marquee select • Click cards • Use hotkeys
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0 top-12"
        style={{ cursor: 'crosshair' }}
      >
        <SelectionOverlay
          containerRef={containerRef}
          onSelectionChange={handleSelectionChange}
          onGroup={handleGroup}
          onUngroup={handleUngroup}
          onDelete={handleDelete}
        />

        {/* Cards */}
        {cards.map((card) => (
          <div
            key={card.id}
            className="absolute"
            style={{ left: card.x, top: card.y }}
          >
            <TestCard id={card.id} label={card.label} />
          </div>
        ))}

        {/* Info Panels */}
        <SelectionInfoPanel />
        <HotkeyHelpPanel />

        {/* Event Log */}
        <div
          className="absolute bottom-4 left-4 w-80 p-3 rounded"
          style={{
            backgroundColor: COLORS.neutral[900],
            border: `1px solid ${COLORS.neutral[800]}`,
          }}
        >
          <div className="font-mono text-neutral-400 mb-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            EVENT LOG
          </div>
          <div className="space-y-0.5 font-mono" style={{ fontSize: '10px' }}>
            {log.length === 0 ? (
              <div className="text-neutral-600">No events yet...</div>
            ) : (
              log.map((entry, i) => (
                <div key={i} className="text-neutral-500">
                  {entry}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SelectionTestbed
