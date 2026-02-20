/**
 * Floating Panel STX Instance
 *
 * Singleton stx instance combining:
 * - Legend-State: Panel data, positions, z-order, modifier keys
 * - XState: Lifecycle machine (idle, dragging, resizing, opening, closing)
 * - Effect-TS: Persistence, spawn from modal, animations
 *
 * @pattern Singleton stx (like ava-stx.ts)
 * @module
 */

import { Effect } from 'effect'
import { stx, batch, type Stx } from '@/lib/stx'
import { panelMachine } from './machines/panel-machine'
import type {
  FloatingStxData,
  PanelState,
  PanelConfig,
  Position,
  Dimensions,
  ModifierKeys,
  PanelVisibility,
  PanelStorage,
  PersistedPanelState,
} from './types'
import { cascadePosition, type PanelRect, type Viewport } from './utils/position'
import { getBounds } from './context/FloatingBoundsContext'

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'tmnl-floating-panels'
const DEFAULT_WIDTH = 320
const DEFAULT_HEIGHT = 240
const BASE_Z_INDEX = 1000

// =============================================================================
// Initial Data
// =============================================================================

const initialData: FloatingStxData = {
  panels: new Map<string, PanelState>(),
  zOrder: [],
  activePanel: null,
  resizingPanel: null,
  draggingPanel: null,
  modifierKeys: {
    shift: false,
    ctrl: false,
    alt: false,
  },
  baseZIndex: BASE_Z_INDEX,
  gridSize: 0,
  snapEnabled: true,
}

// =============================================================================
// Effects
// =============================================================================

const floatingEffects = {
  /**
   * Persist panel state to localStorage
   */
  persist: Effect.gen(function* () {
    // This will be called with stx instance via closure
    yield* Effect.sync(() => {
      const stx = getFloatingStx()
      const panels = stx.data.panels.peek()
      const zOrder = stx.data.zOrder.peek()

      const storage: PanelStorage = {
        panels: {},
        order: zOrder,
        version: 1,
      }

      panels.forEach((panel, id) => {
        storage.panels[id] = {
          position: panel.position,
          dimensions: panel.dimensions,
          visibility: panel.visibility,
          mode: panel.mode,
        }
      })

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storage))
      } catch {
        // Storage might be full or unavailable
      }
    })
  }),

  /**
   * Restore panel state from localStorage
   */
  restore: Effect.gen(function* () {
    yield* Effect.sync(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return null

        const storage = JSON.parse(stored) as PanelStorage
        return storage
      } catch {
        return null
      }
    })
  }),

  /**
   * Spawn a floating panel from modal detach
   */
  spawnFromModal: (visitorId: string, visitorData: unknown, position?: Position) =>
    Effect.gen(function* () {
      const panelId = `modal-${visitorId}-${Date.now()}`

      // Delegate to registerPanel for smart cascade placement
      yield* Effect.sync(() => {
        registerPanel({
          id: panelId,
          title: visitorId,
          mode: 'floating',
          initialPosition: position,
          visitorId,
          visitorData,
        })
      })

      return panelId
    }),


}

// =============================================================================
// Computed Values
// =============================================================================

const floatingComputed = {
  /**
   * Panels sorted by z-index (ascending)
   */
  sortedPanels: (get: { data: FloatingStxData }) => {
    const panels = get.data.panels
    const zOrder = get.data.zOrder

    // Map over zOrder to get panels in correct order
    return zOrder
      .map((id: string) => panels.get(id))
      .filter((p): p is PanelState => p !== undefined)
  },

  /**
   * Top panel (highest z-index)
   */
  topPanel: (get: { data: FloatingStxData }) => {
    const zOrder = get.data.zOrder
    return zOrder[zOrder.length - 1] ?? null
  },

  /**
   * Currently active panel data
   */
  activePanelData: (get: { data: FloatingStxData }) => {
    const activeId = get.data.activePanel
    if (!activeId) return null
    return get.data.panels.get(activeId) ?? null
  },

  /**
   * Resize sensitivity based on modifier keys
   * - Normal: 1.0
   * - Shift: 0.1 (fine)
   * - Ctrl+Shift: 0.01 (ultra-fine)
   */
  resizeSensitivity: (get: { data: FloatingStxData }) => {
    // Access observable value via .get() pattern (Legend-State)
    const mods = typeof get.data.modifierKeys.get === 'function'
      ? get.data.modifierKeys.get()
      : get.data.modifierKeys
    if (mods.ctrl && mods.shift) return 0.01
    if (mods.shift) return 0.1
    return 1.0
  },

  /**
   * Visible panels only
   */
  visiblePanels: (get: { data: FloatingStxData }) => {
    const panels = get.data.panels
    const zOrder = get.data.zOrder

    return zOrder
      .map((id: string) => panels.get(id))
      .filter((p): p is PanelState => p !== undefined && p.visibility === 'visible')
  },

}

// =============================================================================
// STX Instance Type
// =============================================================================

type FloatingStx = Stx<
  typeof panelMachine,
  FloatingStxData,
  typeof floatingEffects,
  typeof floatingComputed
>

// =============================================================================
// Singleton Instance
// =============================================================================

let _floatingStx: FloatingStx | null = null

/**
 * Get the singleton floating panel stx instance
 */
export function getFloatingStx(): FloatingStx {
  if (!_floatingStx) {
    _floatingStx = stx({
      machine: panelMachine,
      data: initialData,
      effects: floatingEffects,
      computed: floatingComputed,
    }) as FloatingStx
  }
  return _floatingStx
}

/**
 * Reset the floating panel stx instance
 */
export function resetFloatingStx(): void {
  if (_floatingStx) {
    _floatingStx.reset()
  }
}

/**
 * Dispose the floating panel stx instance
 */
export function disposeFloatingStx(): void {
  if (_floatingStx) {
    _floatingStx.dispose()
    _floatingStx = null
  }
}

// =============================================================================
// Helper Operations (mutate stx.data directly)
// =============================================================================

/**
 * Register a new panel.
 * Uses cascade placement to avoid stacking panels on top of each other.
 * If `config.initialPosition` is provided, it's used as-is (user override).
 */
export function registerPanel(config: PanelConfig): PanelState {
  const stx = getFloatingStx()
  const dims = config.initialDimensions ?? { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }

  // ─── Smart placement ─────────────────────────────────────────
  let position: Position
  if (config.initialPosition) {
    // User explicitly set position — respect it
    position = config.initialPosition
  } else {
    // Cascade: collect existing panel rects, find next non-overlapping slot
    const panelsMap = stx.data.panels.peek()
    const existingRects: PanelRect[] = []
    panelsMap.forEach((p) => {
      if (p.visibility !== 'hidden') {
        existingRects.push({ x: p.position.x, y: p.position.y, width: p.dimensions.width, height: p.dimensions.height })
      }
    })

    // Use bounds container if available, else fall back to window viewport
    const bounds = getBounds()
    const viewport: Viewport = bounds
      ? { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height }
      : {
          x: 0,
          y: 0,
          width: typeof window !== 'undefined' ? window.innerWidth : 800,
          height: typeof window !== 'undefined' ? window.innerHeight : 600,
        }

    position = cascadePosition(existingRects, dims, viewport)
  }

  const panel: PanelState = {
    id: config.id,
    title: config.title,
    mode: config.mode ?? 'floating',
    position,
    dimensions: dims,
    constraints: config.constraints ?? { minWidth: 200, minHeight: 150 },
    zIndex: stx.data.baseZIndex.peek() + stx.data.zOrder.peek().length,
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
 * Unregister a panel
 */
export function unregisterPanel(id: string): void {
  const stx = getFloatingStx()

  batch(() => {
    stx.data.panels.delete(id)
    stx.data.zOrder.set(stx.data.zOrder.peek().filter((pid: string) => pid !== id))

    if (stx.data.activePanel.peek() === id) {
      const nextTop = stx.data.zOrder.peek()[stx.data.zOrder.peek().length - 1] ?? null
      stx.data.activePanel.set(nextTop)
    }
  })
}

/**
 * Update panel position
 */
export function updatePanelPosition(id: string, position: Position): void {
  const panelObs = getFloatingStx().data.panels.get(id)
  if (panelObs?.peek()) {
    panelObs.position.set(position)
  }
}

/**
 * Update panel dimensions
 */
export function updatePanelDimensions(id: string, dimensions: Dimensions): void {
  const panelObs = getFloatingStx().data.panels.get(id)
  const panel = panelObs?.peek()
  if (!panel) return

  // Apply constraints
  const constrained: Dimensions = {
    width: Math.max(
      panel.constraints.minWidth ?? 200,
      Math.min(dimensions.width, panel.constraints.maxWidth ?? Infinity)
    ),
    height: Math.max(
      panel.constraints.minHeight ?? 150,
      Math.min(dimensions.height, panel.constraints.maxHeight ?? Infinity)
    ),
  }

  panelObs.dimensions.set(constrained)
}

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

    // Update z-indices (fine-grained per-panel)
    const baseZ = stx.data.baseZIndex.peek()
    zOrder.forEach((pid, index) => {
      const panelObs = stx.data.panels.get(pid)
      if (panelObs?.peek()) {
        panelObs.zIndex.set(baseZ + index)
      }
    })
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

    // Update z-indices (fine-grained per-panel)
    const baseZ = stx.data.baseZIndex.peek()
    zOrder.forEach((pid, index) => {
      const panelObs = stx.data.panels.get(pid)
      if (panelObs?.peek()) {
        panelObs.zIndex.set(baseZ + index)
      }
    })
  })
}

/**
 * Set panel visibility
 */
export function setPanelVisibility(id: string, visibility: PanelVisibility): void {
  const panelObs = getFloatingStx().data.panels.get(id)
  if (panelObs?.peek()) {
    panelObs.visibility.set(visibility)
  }
}

/**
 * Close panel (remove from state)
 */
export function closePanel(id: string): void {
  unregisterPanel(id)
}

/**
 * Toggle panel mode between floating and docked
 */
export function togglePanelMode(id: string): void {
  const panelObs = getFloatingStx().data.panels.get(id)
  const panel = panelObs?.peek()
  if (panel) {
    panelObs.mode.set(panel.mode === 'floating' ? 'docked' : 'floating')
  }
}

/**
 * Update modifier keys state
 */
export function updateModifierKeys(keys: Partial<ModifierKeys>): void {
  const stx = getFloatingStx()
  const current = stx.data.modifierKeys.peek()
  stx.data.modifierKeys.set({ ...current, ...keys })
}

/**
 * Set dragging state for a panel
 */
export function setDragging(id: string, isDragging: boolean): void {
  const stx = getFloatingStx()

  batch(() => {
    const panelObs = stx.data.panels.get(id)
    if (panelObs?.peek()) {
      panelObs.isDragging.set(isDragging)
    }
    stx.data.draggingPanel.set(isDragging ? id : null)
  })
}

/**
 * Set resizing state for a panel
 */
export function setResizing(id: string, isResizing: boolean): void {
  const stx = getFloatingStx()

  batch(() => {
    const panelObs = stx.data.panels.get(id)
    if (panelObs?.peek()) {
      panelObs.isResizing.set(isResizing)
    }
    stx.data.resizingPanel.set(isResizing ? id : null)
  })
}

/**
 * Get panel by ID
 */
export function getPanel(id: string): PanelState | undefined {
  return getFloatingStx().data.panels.get(id)?.peek()
}

/**
 * Set snap-to-grid size (0 = disabled)
 */
export function setGridSize(size: number): void {
  getFloatingStx().data.gridSize.set(Math.max(0, size))
}

/**
 * Toggle snap-to-grid on/off
 */
export function toggleSnap(): void {
  const stx = getFloatingStx()
  stx.data.snapEnabled.set(!stx.data.snapEnabled.peek())
}

/**
 * Set snap enabled state
 */
export function setSnapEnabled(enabled: boolean): void {
  getFloatingStx().data.snapEnabled.set(enabled)
}

/**
 * Restore persisted state and apply to registered panels
 */
export function restorePersistedState(storage: PanelStorage): void {
  const stx = getFloatingStx()

  batch(() => {
    // Update existing panels with persisted state (fine-grained)
    for (const [id, persisted] of Object.entries(storage.panels)) {
      const panelObs = stx.data.panels.get(id)
      if (panelObs?.peek()) {
        panelObs.position.set(persisted.position)
        panelObs.dimensions.set(persisted.dimensions)
        panelObs.visibility.set(persisted.visibility)
        panelObs.mode.set(persisted.mode)
      }
    }

    // Restore z-order for panels that exist
    const panelsMap = stx.data.panels.peek()
    const existingIds = new Set(panelsMap.keys())
    const validOrder = storage.order.filter(id => existingIds.has(id))

    // Add any panels not in persisted order
    panelsMap.forEach((_, id) => {
      if (!validOrder.includes(id)) {
        validOrder.push(id)
      }
    })

    stx.data.zOrder.set(validOrder)
  })
}

/**
 * Maximize panel to fill bounds container (or viewport if no bounds).
 * Stores current position/dimensions for restore.
 */
export function maximizePanel(id: string): void {
  const panelObs = getFloatingStx().data.panels.get(id)
  const panel = panelObs?.peek()
  if (!panel || panel.isMaximized) return

  // Use bounds container if available, else fall back to viewport
  const bounds = getBounds()
  const maxPosition: Position = bounds
    ? { x: bounds.left, y: bounds.top }
    : { x: 0, y: 0 }
  const maxDimensions: Dimensions = bounds
    ? { width: bounds.width, height: bounds.height }
    : {
        width: typeof window !== 'undefined' ? window.innerWidth : 1920,
        height: typeof window !== 'undefined' ? window.innerHeight : 1080,
      }

  batch(() => {
    panelObs.isMaximized.set(true)
    panelObs.preMaximizePosition.set({ ...panel.position })
    panelObs.preMaximizeDimensions.set({ ...panel.dimensions })
    panelObs.position.set(maxPosition)
    panelObs.dimensions.set(maxDimensions)
  })

  bringPanelToFront(id)
}

/**
 * Restore panel from maximized state
 */
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



