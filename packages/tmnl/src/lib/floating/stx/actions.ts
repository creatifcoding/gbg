/**
 * Floating STX actions — all panel mutation functions
 *
 * Every function reads/writes via the singleton stx instance.
 * Flat, independent mutations. Internal calls:
 *   - closePanel → unregisterPanel
 *   - maximizePanel → bringPanelToFront
 *
 * PERF NOTES:
 *   - getFloatingStx() is cached singleton (zero cost after first call)
 *   - .peek() reads bypass reactivity (no subscription overhead)
 *   - batch() coalesces Legend-State notifications
 *   - reassignZIndices uses indexed for-loop (not forEach)
 *   - zOrder reads are cached within batch scopes
 *
 * @module
 */

import { batch } from '@/lib/stx'
import type {
  PanelState,
  PanelConfig,
  Position,
  Dimensions,
  ModifierKeys,
  PanelVisibility,
  PanelStorage,
} from '../types'
import { cascadePosition, type PanelRect, type Viewport } from '../utils/position'
import { getBounds } from '../context/FloatingBoundsContext'
import { DEFAULT_WIDTH, DEFAULT_HEIGHT } from './constants'
import { getFloatingStx } from './instance'

// =============================================================================
// Helpers
// =============================================================================

/**
 * Reassign z-indices for all panels in z-order.
 * Uses indexed for-loop — faster than forEach for hot path.
 */
function reassignZIndices(zOrder: readonly string[]): void {
  const stx = getFloatingStx()
  const baseZ = stx.data.baseZIndex.peek()
  for (let i = 0; i < zOrder.length; i++) {
    const panelObs = stx.data.panels.get(zOrder[i])
    if (panelObs?.peek()) {
      panelObs.zIndex.set(baseZ + i)
    }
  }
}

/** Get workspace viewport (bounds container or window fallback) */
function getViewport(): Viewport {
  const bounds = getBounds()
  if (bounds) {
    return { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height }
  }
  return {
    x: 0, y: 0,
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 600,
  }
}

/** Get full-size dimensions for maximize (bounds or viewport) */
function getMaxBounds(): { position: Position; dimensions: Dimensions } {
  const bounds = getBounds()
  if (bounds) {
    return { position: { x: bounds.left, y: bounds.top }, dimensions: { width: bounds.width, height: bounds.height } }
  }
  return {
    position: { x: 0, y: 0 },
    dimensions: {
      width: typeof window !== 'undefined' ? window.innerWidth : 1920,
      height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    },
  }
}

// =============================================================================
// Panel CRUD
// =============================================================================

/**
 * Register a new panel.
 * Uses cascade placement to avoid stacking panels on top of each other.
 */
export function registerPanel(config: PanelConfig): PanelState {
  const stx = getFloatingStx()
  const dims = config.initialDimensions ?? { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }

  // Smart placement
  let position: Position
  if (config.initialPosition) {
    position = config.initialPosition
  } else {
    const panelsMap = stx.data.panels.peek()
    const existingRects: PanelRect[] = []
    panelsMap.forEach((p) => {
      if (p.visibility !== 'hidden') {
        existingRects.push({ x: p.position.x, y: p.position.y, width: p.dimensions.width, height: p.dimensions.height })
      }
    })
    position = cascadePosition(existingRects, dims, getViewport())
  }

  // Cache zOrder length + baseZ for single read
  const zOrderLen = stx.data.zOrder.peek().length
  const baseZ = stx.data.baseZIndex.peek()

  const panel: PanelState = {
    id: config.id,
    title: config.title,
    mode: config.mode ?? 'floating',
    position,
    dimensions: dims,
    constraints: config.constraints ?? { minWidth: 200, minHeight: 150 },
    zIndex: baseZ + zOrderLen,
    visibility: 'visible',
    isDragging: false,
    isResizing: false,
    isMaximized: false,
    preMaximizePosition: undefined,
    preMaximizeDimensions: undefined,
    closable: config.closable ?? true,
    minimizable: config.minimizable ?? true,
    resizable: config.resizable ?? true,
    visitorId: config.visitorId,
    visitorData: config.visitorData,
  }

  batch(() => {
    stx.data.panels.set(config.id, panel)
    stx.data.zOrder.set([...stx.data.zOrder.peek(), config.id])
  })

  return panel
}

/**
 * Unregister a panel (removes from state + z-order)
 */
export function unregisterPanel(id: string): void {
  const stx = getFloatingStx()
  batch(() => {
    stx.data.panels.delete(id)
    const newOrder = stx.data.zOrder.peek().filter((pid: string) => pid !== id)
    stx.data.zOrder.set(newOrder)
    if (stx.data.activePanel.peek() === id) {
      stx.data.activePanel.set(newOrder[newOrder.length - 1] ?? null)
    }
  })
}

/**
 * Close panel (alias for unregisterPanel)
 */
export function closePanel(id: string): void {
  unregisterPanel(id)
}

/**
 * Get panel snapshot by ID
 */
export function getPanel(id: string): PanelState | undefined {
  return getFloatingStx().data.panels.get(id)?.peek()
}

// =============================================================================
// Position & Dimensions
// =============================================================================

/**
 * Update panel position (fine-grained write)
 */
export function updatePanelPosition(id: string, position: Position): void {
  getFloatingStx().data.panels.get(id)?.position.set(position)
}

/**
 * Update panel dimensions with constraint enforcement
 */
export function updatePanelDimensions(id: string, dimensions: Dimensions): void {
  const panelObs = getFloatingStx().data.panels.get(id)
  const panel = panelObs?.peek()
  if (!panel) return

  panelObs.dimensions.set({
    width: Math.max(panel.constraints.minWidth ?? 200, Math.min(dimensions.width, panel.constraints.maxWidth ?? Infinity)),
    height: Math.max(panel.constraints.minHeight ?? 150, Math.min(dimensions.height, panel.constraints.maxHeight ?? Infinity)),
  })
}

// =============================================================================
// Z-Order
// =============================================================================

/**
 * Bring panel to front (highest z-index)
 */
export function bringPanelToFront(id: string): void {
  const stx = getFloatingStx()
  batch(() => {
    const zOrder = stx.data.zOrder.peek().filter((pid: string) => pid !== id)
    zOrder.push(id)
    stx.data.zOrder.set(zOrder)
    stx.data.activePanel.set(id)
    reassignZIndices(zOrder)
  })
}

/**
 * Send panel to back (lowest z-index)
 */
export function sendPanelToBack(id: string): void {
  const stx = getFloatingStx()
  batch(() => {
    const zOrder = stx.data.zOrder.peek().filter((pid: string) => pid !== id)
    zOrder.unshift(id)
    stx.data.zOrder.set(zOrder)
    reassignZIndices(zOrder)
  })
}

// =============================================================================
// Visibility & Mode
// =============================================================================

/** Set panel visibility */
export function setPanelVisibility(id: string, visibility: PanelVisibility): void {
  getFloatingStx().data.panels.get(id)?.visibility.set(visibility)
}

/** Toggle panel mode between floating and docked */
export function togglePanelMode(id: string): void {
  const panelObs = getFloatingStx().data.panels.get(id)
  const panel = panelObs?.peek()
  if (panel) {
    panelObs.mode.set(panel.mode === 'floating' ? 'docked' : 'floating')
  }
}

// =============================================================================
// Interaction State
// =============================================================================

/** Update modifier keys (Shift/Ctrl/Alt) */
export function updateModifierKeys(keys: Partial<ModifierKeys>): void {
  const stx = getFloatingStx()
  const current = stx.data.modifierKeys.peek()
  stx.data.modifierKeys.set({ ...current, ...keys })
}

/** Set dragging state for a panel */
export function setDragging(id: string, isDragging: boolean): void {
  const stx = getFloatingStx()
  batch(() => {
    stx.data.panels.get(id)?.isDragging.set(isDragging)
    stx.data.draggingPanel.set(isDragging ? id : null)
  })
}

/** Set resizing state for a panel */
export function setResizing(id: string, isResizing: boolean): void {
  const stx = getFloatingStx()
  batch(() => {
    stx.data.panels.get(id)?.isResizing.set(isResizing)
    stx.data.resizingPanel.set(isResizing ? id : null)
  })
}

// =============================================================================
// Snap & Grid
// =============================================================================

/** Set snap-to-grid size (0 = disabled) */
export function setGridSize(size: number): void {
  getFloatingStx().data.gridSize.set(Math.max(0, size))
}

/** Toggle snap-to-grid on/off */
export function toggleSnap(): void {
  const stx = getFloatingStx()
  stx.data.snapEnabled.set(!stx.data.snapEnabled.peek())
}

/** Set snap enabled state */
export function setSnapEnabled(enabled: boolean): void {
  getFloatingStx().data.snapEnabled.set(enabled)
}

// =============================================================================
// Persistence
// =============================================================================

/** Restore persisted state and apply to registered panels */
export function restorePersistedState(storage: PanelStorage): void {
  const stx = getFloatingStx()
  batch(() => {
    // Apply persisted panel state
    for (const [id, persisted] of Object.entries(storage.panels)) {
      const panelObs = stx.data.panels.get(id)
      if (panelObs?.peek()) {
        panelObs.position.set(persisted.position)
        panelObs.dimensions.set(persisted.dimensions)
        panelObs.visibility.set(persisted.visibility)
        panelObs.mode.set(persisted.mode)
      }
    }

    // Restore z-order (only for panels that exist)
    const panelsMap = stx.data.panels.peek()
    const existingIds = new Set(panelsMap.keys())
    const validOrder = storage.order.filter(id => existingIds.has(id))
    // Add panels not in persisted order
    for (const [id] of panelsMap) {
      if (!validOrder.includes(id)) validOrder.push(id)
    }
    stx.data.zOrder.set(validOrder)
  })
}

// =============================================================================
// Maximize / Restore
// =============================================================================

/** Maximize panel to fill bounds container (or viewport) */
export function maximizePanel(id: string): void {
  const panelObs = getFloatingStx().data.panels.get(id)
  const panel = panelObs?.peek()
  if (!panel || panel.isMaximized) return

  const { position: maxPos, dimensions: maxDims } = getMaxBounds()

  batch(() => {
    panelObs.isMaximized.set(true)
    panelObs.preMaximizePosition.set({ ...panel.position })
    panelObs.preMaximizeDimensions.set({ ...panel.dimensions })
    panelObs.position.set(maxPos)
    panelObs.dimensions.set(maxDims)
  })

  bringPanelToFront(id)
}

/** Restore panel from maximized state */
export function restorePanel(id: string): void {
  const panelObs = getFloatingStx().data.panels.get(id)
  const panel = panelObs?.peek()
  if (!panel || !panel.isMaximized) return

  batch(() => {
    panelObs.isMaximized.set(false)
    panelObs.position.set(panel.preMaximizePosition ?? panel.position)
    panelObs.dimensions.set(panel.preMaximizeDimensions ?? panel.dimensions)
    panelObs.preMaximizePosition.set(undefined)
    panelObs.preMaximizeDimensions.set(undefined)
  })
}
