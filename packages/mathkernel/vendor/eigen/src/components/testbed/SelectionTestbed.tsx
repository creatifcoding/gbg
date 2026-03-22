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
import { SelectionOverlay, useSelection, useSelectable, getSelectedIds, getGroupForItem } from '@/lib/selection'
import { SelectionRing } from '@/components/affordances'
import { COLORS } from '@/lib/capabilities/tokens'
import {
  useDragOrchestrator,
  useElementBlurStyle,
  startDrag as orchestratorStartDrag,
  updateDragPosition,
  endDrag as orchestratorEndDrag,
} from '@/lib/drag'

// =============================================================================
// Types
// =============================================================================

interface Position {
  x: number
  y: number
}

interface CardData {
  id: string
  label: string
  position: Position
}

// =============================================================================
// Draggable Test Card Component
// =============================================================================

interface TestCardProps {
  id: string
  label: string
  position: Position
  onDragStart: (id: string, cardPos: Position, pointerPos: Position) => void
  onDrag: (id: string, delta: Position) => void
  onDragEnd: (id: string) => void
}

function TestCard({ id, label, position, onDragStart, onDrag, onDragEnd }: TestCardProps) {
  const { selectableProps, isSelected } = useSelectable(id)
  const isDragging = useRef(false)
  const dragStartPos = useRef<Position | null>(null)

  // Direction-aware motion blur from drag orchestrator
  // This now works for ALL elements being dragged, not just the primary
  const blurStyle = useElementBlurStyle(id)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only drag on left click
    if (e.button !== 0) return

    // Prevent text selection
    e.preventDefault()

    isDragging.current = true
    dragStartPos.current = { x: e.clientX, y: e.clientY }

    // Pass both card position and pointer position
    onDragStart(id, position, { x: e.clientX, y: e.clientY })

    // Capture pointer for drag tracking outside element
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [id, position, onDragStart])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !dragStartPos.current) return

    const delta: Position = {
      x: e.clientX - dragStartPos.current.x,
      y: e.clientY - dragStartPos.current.y,
    }

    onDrag(id, delta)
  }, [id, onDrag])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return

    isDragging.current = false
    dragStartPos.current = null

    e.currentTarget.releasePointerCapture(e.pointerId)
    onDragEnd(id)
  }, [id, onDragEnd])

  return (
    <div
      {...selectableProps}
      className="relative w-32 h-24 rounded cursor-grab active:cursor-grabbing transition-shadow hover:shadow-lg"
      style={{
        backgroundColor: COLORS.neutral[800],
        border: `1px solid ${COLORS.neutral[700]}`,
        userSelect: 'none',
        // Apply motion blur from drag orchestrator
        filter: blurStyle.filter,
        transform: blurStyle.transform,
        transition: blurStyle.transition,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <SelectionRing selected={isSelected} color="cyan" style="ring" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className="font-mono text-neutral-400"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {label}
        </span>
      </div>
      <div
        className="absolute bottom-1 left-1 font-mono text-neutral-600 pointer-events-none"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {id}
      </div>
    </div>
  )
}

// =============================================================================
// Drag Debug Panel
// =============================================================================

function DragDebugPanel() {
  const { isDragging, velocity, blurStyle, operation } = useDragOrchestrator()

  return (
    <div
      className="absolute top-4 left-4 w-72 p-3 rounded z-50"
      style={{
        backgroundColor: COLORS.neutral[900],
        border: `1px solid ${COLORS.neutral[800]}`,
      }}
    >
      <div className="font-mono text-neutral-400 mb-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        DRAG DEBUG
      </div>

      <div className="space-y-1 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        <div className="flex justify-between">
          <span className="text-neutral-500">isDragging:</span>
          <span className={isDragging ? 'text-green-400' : 'text-neutral-600'}>
            {isDragging ? 'YES' : 'no'}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-neutral-500">elements:</span>
          <span className="text-cyan-400">{operation?.elementIds.length ?? 0}</span>
        </div>

        <div className="border-t border-neutral-800 pt-1 mt-1">
          <div className="text-neutral-500 mb-1">Velocity:</div>
          <div className="pl-2 text-neutral-600">
            <div>magnitude: <span className="text-yellow-400">{velocity.magnitude.toFixed(1)}</span></div>
            <div>angle: <span className="text-yellow-400">{((velocity.angle * 180) / Math.PI).toFixed(1)}°</span></div>
            <div>smoothed: ({velocity.smoothed.x.toFixed(1)}, {velocity.smoothed.y.toFixed(1)})</div>
          </div>
        </div>

        <div className="border-t border-neutral-800 pt-1 mt-1">
          <div className="text-neutral-500 mb-1">BlurStyle:</div>
          <div className="pl-2 text-neutral-600">
            <div>isActive: <span className={blurStyle.isActive ? 'text-green-400' : 'text-neutral-600'}>{blurStyle.isActive ? 'YES' : 'no'}</span></div>
            <div>blurAmount: <span className="text-cyan-400">{blurStyle.blurAmount.toFixed(2)}px</span></div>
            <div>strategy: <span className="text-purple-400">{blurStyle.strategy}</span></div>
            <div className="text-neutral-700 truncate">filter: {blurStyle.filter ?? 'none'}</div>
            <div className="text-neutral-700 truncate">transform: {blurStyle.transform ?? 'none'}</div>
          </div>
        </div>
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
// Initial Card Data
// =============================================================================

const INITIAL_CARDS: CardData[] = [
  { id: 'card-1', label: 'Alpha', position: { x: 50, y: 50 } },
  { id: 'card-2', label: 'Beta', position: { x: 200, y: 50 } },
  { id: 'card-3', label: 'Gamma', position: { x: 350, y: 50 } },
  { id: 'card-4', label: 'Delta', position: { x: 50, y: 200 } },
  { id: 'card-5', label: 'Epsilon', position: { x: 200, y: 200 } },
  { id: 'card-6', label: 'Zeta', position: { x: 350, y: 200 } },
  { id: 'card-7', label: 'Eta', position: { x: 125, y: 350 } },
  { id: 'card-8', label: 'Theta', position: { x: 275, y: 350 } },
]

// =============================================================================
// Main Testbed
// =============================================================================

export function SelectionTestbed() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [cards, setCards] = useState<CardData[]>(INITIAL_CARDS)
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [log, setLog] = useState<string[]>([])

  // Track drag state for group movement
  const dragState = useRef<{
    activeId: string | null
    startPositions: Map<string, Position>
  }>({ activeId: null, startPositions: new Map() })

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

  // =============================================================================
  // Drag Handlers - Query selection system for co-movement + drag orchestrator
  // =============================================================================

  const handleDragStart = useCallback((id: string, _cardPos: Position, pointerPos: Position) => {
    // Get all items that should move together:
    // 1. The dragged item
    // 2. All selected items (if dragged item is selected)
    // 3. All items in the same group as dragged item
    const selectedIds = getSelectedIds()
    const group = getGroupForItem(id)

    const idsToMove = new Set<string>([id])

    // If dragged item is selected, include all selected items
    if (selectedIds.has(id)) {
      selectedIds.forEach((sid) => idsToMove.add(sid))
    }

    // Include all group members
    if (group) {
      group.memberIds.forEach((mid) => idsToMove.add(mid))
    }

    // Store start positions for all items that will move
    const startPositions = new Map<string, Position>()
    setCards((current) => {
      current.forEach((card) => {
        if (idsToMove.has(card.id)) {
          startPositions.set(card.id, { ...card.position })
        }
      })
      return current
    })

    dragState.current = { activeId: id, startPositions }

    // Start drag orchestrator with pointer position for velocity tracking
    // This enables motion blur for ALL elements being dragged
    orchestratorStartDrag('selection', id, Array.from(idsToMove), pointerPos)
  }, [])

  const handleDrag = useCallback((_id: string, delta: Position) => {
    const { startPositions } = dragState.current
    if (startPositions.size === 0) return

    setCards((current) =>
      current.map((card) => {
        const startPos = startPositions.get(card.id)
        if (!startPos) return card

        return {
          ...card,
          position: {
            x: startPos.x + delta.x,
            y: startPos.y + delta.y,
          },
        }
      })
    )
  }, [])

  // Track pointer position for velocity calculation
  const lastPointerPos = useRef<Position | null>(null)

  const handlePointerMoveForVelocity = useCallback((e: React.PointerEvent) => {
    if (dragState.current.activeId) {
      // Update drag orchestrator with current pointer position for velocity tracking
      updateDragPosition({ x: e.clientX, y: e.clientY })
      lastPointerPos.current = { x: e.clientX, y: e.clientY }
    }
  }, [])

  const handleDragEnd = useCallback((_id: string) => {
    dragState.current = { activeId: null, startPositions: new Map() }
    lastPointerPos.current = null

    // End drag orchestrator
    orchestratorEndDrag()
  }, [])

  // Filter deleted cards
  const visibleCards = cards.filter((card) => !deletedIds.includes(card.id))

  return (
    <div
      className="h-screen w-screen overflow-hidden"
      style={{ backgroundColor: COLORS.neutral[950], userSelect: 'none' }}
    >
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
          Drag cards • Marquee select • Shift+G to group • Drag group to move together
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0 top-12"
        style={{ cursor: 'crosshair' }}
        onPointerMove={handlePointerMoveForVelocity}
      >
        <SelectionOverlay
          containerRef={containerRef}
          onSelectionChange={handleSelectionChange}
          onGroup={handleGroup}
          onUngroup={handleUngroup}
          onDelete={handleDelete}
        />

        {/* Cards */}
        {visibleCards.map((card) => (
          <div
            key={card.id}
            className="absolute"
            style={{ left: card.position.x, top: card.position.y }}
          >
            <TestCard
              id={card.id}
              label={card.label}
              position={card.position}
              onDragStart={handleDragStart}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
            />
          </div>
        ))}

        {/* Info Panels */}
        <DragDebugPanel />
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
          <div className="space-y-0.5 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
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
