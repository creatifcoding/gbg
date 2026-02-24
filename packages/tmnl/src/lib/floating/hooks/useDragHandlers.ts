/**
 * useDragHandlers — dnd-kit drag start/end logic for floating panels + tabs
 *
 * Encapsulates snap target caching, drag state management,
 * clamp-on-drop, dock resolution, tab reorder/transfer/tear-off,
 * and sortable delegation.
 *
 * Tab drag discrimination (v2):
 *   - Sortable IDs prefixed with "tab:" carry type:'tab' data payload
 *   - Reorder: same hostPanelId, over is also a tab
 *   - Transfer: different hostPanelId, over is a tab
 *   - Tear-off: no tab target (dropped on panel body or empty space)
 *
 * @module
 */

import { useCallback, type MutableRefObject } from 'react'
import {
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'

import { batch } from '@/lib/stx'
import {
  getFloatingStx,
  updatePanelPosition,
  updatePanelDimensions,
  bringPanelToFront,
  setDragging,
  getPanel as stxGetPanel,
} from '../floating-stx'
import {
  reorderTabs,
  transferTab,
  liftTabOut,
  floatPanel,
} from '../stx/actions'
import type { Position } from '../types'
import { clampToViewport, type PanelRect, type Viewport } from '../utils/position'
import { resolveDockLayout } from '../dock'
import type { DragSnapState } from '../modifiers'
import { TEAR_OFF_THRESHOLD_Y } from '../FloatingDragOverlay'

// =============================================================================
// Types
// =============================================================================

/** Parsed tab drag data from useSortable data payload */
interface TabDragData {
  type: 'tab'
  hostPanelId: string
  tabId: string
  label: string
}

function isTabDragData(data: unknown): data is TabDragData {
  return !!data && typeof data === 'object' && (data as any).type === 'tab'
}

export interface UseDragHandlersOptions {
  dragSnapRef: MutableRefObject<DragSnapState>
  getLocalViewport: () => Viewport
  hideSnapGuides: () => void
  hideDockPreview: () => void
  onSortableDragStart?: (event: DragStartEvent) => void
  onSortableDragEnd?: (event: DragEndEvent) => void
}

export interface UseDragHandlersReturn {
  handleDragStart: (event: DragStartEvent) => void
  handleDragEnd: (event: DragEndEvent) => void
  collisionDetection: typeof closestCenter
}

// =============================================================================
// Hook
// =============================================================================

export function useDragHandlers({
  dragSnapRef,
  getLocalViewport,
  hideSnapGuides,
  hideDockPreview,
  onSortableDragStart,
  onSortableDragEnd,
}: UseDragHandlersOptions): UseDragHandlersReturn {
  const stx = getFloatingStx()

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      hideSnapGuides()
      hideDockPreview()

      const id = event.active.id as string
      const activeData = event.active.data.current

      // ─── Tab drag start ─────────────────────────────────────
      if (isTabDragData(activeData)) {
        // No snap targets for tab drags — just delegate to sortable
        return
      }

      // ─── Panel drag start ───────────────────────────────────
      const panel = stxGetPanel(id)
      if (panel) {
        // Snapshot snap targets for this drag session (perf)
        const siblings: PanelRect[] = []
        stx.data.panels.peek().forEach((p, pid) => {
          if (pid === id) return
          if (p.visibility !== 'visible') return
          if (p.mode !== 'floating') return
          siblings.push({
            x: p.position.x,
            y: p.position.y,
            width: p.dimensions.width,
            height: p.dimensions.height,
          })
        })
        dragSnapRef.current = {
          activeId: id,
          dimensions: panel.dimensions,
          siblings,
        }

        bringPanelToFront(id)
        setDragging(id, true)
        stx.send?.({ type: 'START_DRAG', panelId: id, position: { x: 0, y: 0 } })
      } else {
        onSortableDragStart?.(event)
      }
    },
    [hideSnapGuides, hideDockPreview, stx, dragSnapRef, onSortableDragStart]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const id = event.active.id as string
      const activeData = event.active.data.current
      const overData = event.over?.data?.current

      // Clear per-drag snap cache + guide overlay
      dragSnapRef.current = { activeId: null, dimensions: null, siblings: [] }
      hideSnapGuides()

      // ─── Tab drag end ───────────────────────────────────────
      if (isTabDragData(activeData)) {
        handleTabDragEnd(activeData, overData, event)
        return
      }

      // ─── Panel drag end ─────────────────────────────────────
      const panel = stxGetPanel(id)
      if (panel) {
        const { delta } = event
        const droppedPosition: Position = {
          x: panel.position.x + delta.x,
          y: panel.position.y + delta.y,
        }

        const viewport = getLocalViewport()
        const clamped = clampToViewport(droppedPosition, panel.dimensions, viewport)
        const docked = resolveDockLayout(clamped, panel.dimensions, viewport)

        batch(() => {
          if (docked) {
            updatePanelPosition(id, docked.position)
            updatePanelDimensions(id, docked.dimensions)
          } else {
            updatePanelPosition(id, clamped)
          }
          setDragging(id, false)
        })

        stx.send?.({ type: 'END_DRAG' })
      } else {
        onSortableDragEnd?.(event)
      }
    },
    [getLocalViewport, hideSnapGuides, hideDockPreview, stx, dragSnapRef, onSortableDragEnd]
  )

  // Domain-aware collision detection:
  // - Floating panels get [] (free drag)
  // - Tabs use closestCenter (for sortable reorder)
  const collisionDetection = useCallback<typeof closestCenter>((args) => {
    const id = args.active.id as string
    const data = args.active.data.current

    // Tab drags: use closestCenter for sortable reorder
    if (isTabDragData(data)) return closestCenter(args)

    // Panel drags: free drag (no collision)
    if (stxGetPanel(id)) return []

    // Other sortables
    return closestCenter(args)
  }, [])

  return { handleDragStart, handleDragEnd, collisionDetection }
}

// =============================================================================
// Tab Drag Resolution
// =============================================================================

/**
 * Handle tab drag completion with three possible outcomes:
 *   1. Reorder — dragged over a tab in the same host panel
 *   2. Transfer — dragged over a tab in a different host panel
 *   3. Tear-off — no valid tab target (Y-threshold exceeded or no over)
 */
function handleTabDragEnd(
  activeData: TabDragData,
  overData: unknown,
  event: DragEndEvent,
): void {
  const overTab = isTabDragData(overData) ? overData : null
  const yDelta = Math.abs(event.delta.y)

  // ── Tear-off: Y-threshold exceeded or no tab target ──────────
  if (yDelta > TEAR_OFF_THRESHOLD_Y || !overTab) {
    // Only non-home tabs can be torn off
    if (activeData.tabId !== activeData.hostPanelId) {
      liftTabOut(activeData.hostPanelId, activeData.tabId)
      floatPanel(activeData.tabId)
    }
    return
  }

  // ── Same host → reorder ──────────────────────────────────────
  if (activeData.hostPanelId === overTab.hostPanelId) {
    if (activeData.tabId === overTab.tabId) return // no-op

    const stx = getFloatingStx()
    const host = stx.data.panels.get(activeData.hostPanelId)?.peek()
    if (!host) return

    // Build full tab list: [hostId, ...ghostTabs]
    const hostId = activeData.hostPanelId
    const allTabIds = [hostId, ...(host.tabs ?? [])]

    const oldIndex = allTabIds.indexOf(activeData.tabId)
    const newIndex = allTabIds.indexOf(overTab.tabId)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(allTabIds, oldIndex, newIndex)
    // Strip home tab from the reorder — it's always position 0 implicitly
    const ghostOrder = reordered.filter(id => id !== hostId)
    reorderTabs(hostId, ghostOrder)
    return
  }

  // ── Different host → transfer ────────────────────────────────
  if (activeData.tabId !== activeData.hostPanelId) {
    // Only ghost tabs can be transferred
    transferTab(activeData.hostPanelId, overTab.hostPanelId, activeData.tabId)
  }
}
