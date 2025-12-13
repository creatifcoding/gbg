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
import { stx, type Stx } from '@/lib/stx'
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
  DragVelocity,
} from './types'

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'tmnl-floating-panels'
const DEFAULT_WIDTH = 320
const DEFAULT_HEIGHT = 240
const BASE_Z_INDEX = 1000
const VELOCITY_SMOOTHING = 0.3 // EMA factor (lower = smoother)

// =============================================================================
// Initial Data
// =============================================================================

const initialVelocity: DragVelocity = {
  x: 0,
  y: 0,
  smoothedX: 0,
  smoothedY: 0,
  magnitude: 0,
  angle: 0,
}

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
  dragVelocity: { ...initialVelocity },
  lastDragPosition: null,
  lastDragTimestamp: 0,
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
      const panels = stx.data.panels.get()
      const zOrder = stx.data.zOrder.get()

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
      const stx = getFloatingStx()
      const panelId = `modal-${visitorId}-${Date.now()}`

      const centerX = (typeof window !== 'undefined' ? window.innerWidth : 800) / 2 - DEFAULT_WIDTH / 2
      const centerY = (typeof window !== 'undefined' ? window.innerHeight : 600) / 2 - DEFAULT_HEIGHT / 2

      const panel: PanelState = {
        id: panelId,
        title: visitorId,
        mode: 'floating',
        position: position ?? { x: centerX, y: centerY },
        dimensions: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
        constraints: { minWidth: 200, minHeight: 150 },
        zIndex: stx.data.baseZIndex.get() + stx.data.zOrder.get().length,
        visibility: 'visible',
        isDragging: false,
        isResizing: false,
        isMaximized: false,
        preMaximizePosition: undefined,
        preMaximizeDimensions: undefined,
        closable: true,
        minimizable: true,
        resizable: true,
        visitorId,
        visitorData,
      }

      // Add to stx data
      yield* Effect.sync(() => {
        const panels = new Map(stx.data.panels.get())
        panels.set(panelId, panel)
        stx.data.panels.set(panels)
        stx.data.zOrder.set([...stx.data.zOrder.get(), panelId])
      })

      return panelId
    }),

  /**
   * Animate panel open (placeholder for GSAP/anime.js)
   */
  animateOpen: (panelId: string) =>
    Effect.gen(function* () {
      // TODO: Implement with GSAP or anime.js
      yield* Effect.sleep('50 millis')
      return panelId
    }),

  /**
   * Animate panel close (placeholder for GSAP/anime.js)
   */
  animateClose: (panelId: string) =>
    Effect.gen(function* () {
      // TODO: Implement with GSAP or anime.js
      yield* Effect.sleep('50 millis')
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

  /**
   * Motion blur style based on drag velocity
   * Returns CSS properties for blur and directional stretch
   */
  motionBlurStyle: (get: { data: FloatingStxData }) => {
    const velocity = typeof get.data.dragVelocity.get === 'function'
      ? get.data.dragVelocity.get()
      : get.data.dragVelocity
    const draggingPanel = typeof get.data.draggingPanel.get === 'function'
      ? get.data.draggingPanel.get()
      : get.data.draggingPanel

    const isActive = draggingPanel !== null && velocity.magnitude > 2

    if (!isActive) {
      return {
        filter: undefined as string | undefined,
        transform: undefined as string | undefined,
        transition: 'filter 0.15s ease-out, transform 0.15s ease-out',
        isActive: false,
        blurAmount: 0,
      }
    }

    // Calculate blur amount (capped at 6px)
    const blurAmount = Math.min(velocity.magnitude * 0.08, 6)

    // Directional stretch for motion smear
    let stretchTransform: string | undefined = undefined
    if (velocity.magnitude > 4) {
      const stretchFactor = Math.min(1 + velocity.magnitude * 0.001, 1.03)
      const angleDeg = (velocity.angle * 180) / Math.PI
      stretchTransform = `rotate(${angleDeg}deg) scaleX(${stretchFactor}) rotate(${-angleDeg}deg)`
    }

    return {
      filter: blurAmount > 0.5 ? `blur(${blurAmount.toFixed(1)}px)` : undefined,
      transform: stretchTransform,
      transition: 'none',
      isActive: true,
      blurAmount,
    }
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
 * Register a new panel
 */
export function registerPanel(config: PanelConfig): PanelState {
  const stx = getFloatingStx()

  const centerX = (typeof window !== 'undefined' ? window.innerWidth : 800) / 2 - DEFAULT_WIDTH / 2
  const centerY = (typeof window !== 'undefined' ? window.innerHeight : 600) / 2 - DEFAULT_HEIGHT / 2

  const panel: PanelState = {
    id: config.id,
    title: config.title,
    mode: config.mode ?? 'floating',
    position: config.initialPosition ?? { x: centerX, y: centerY },
    dimensions: config.initialDimensions ?? { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
    constraints: config.constraints ?? { minWidth: 200, minHeight: 150 },
    zIndex: stx.data.baseZIndex.get() + stx.data.zOrder.get().length,
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

  const panels = new Map(stx.data.panels.get())
  panels.set(config.id, panel)
  stx.data.panels.set(panels)
  stx.data.zOrder.set([...stx.data.zOrder.get(), config.id])

  return panel
}

/**
 * Unregister a panel
 */
export function unregisterPanel(id: string): void {
  const stx = getFloatingStx()

  const panels = new Map(stx.data.panels.get())
  panels.delete(id)
  stx.data.panels.set(panels)
  stx.data.zOrder.set(stx.data.zOrder.get().filter((pid: string) => pid !== id))
}

/**
 * Update panel position
 */
export function updatePanelPosition(id: string, position: Position): void {
  const stx = getFloatingStx()
  const panels = new Map(stx.data.panels.get())
  const panel = panels.get(id)

  if (panel) {
    panels.set(id, { ...panel, position })
    stx.data.panels.set(panels)
  }
}

/**
 * Update panel dimensions
 */
export function updatePanelDimensions(id: string, dimensions: Dimensions): void {
  const stx = getFloatingStx()
  const panels = new Map(stx.data.panels.get())
  const panel = panels.get(id)

  if (panel) {
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

    panels.set(id, { ...panel, dimensions: constrained })
    stx.data.panels.set(panels)
  }
}

/**
 * Bring panel to front (highest z-index)
 */
export function bringPanelToFront(id: string): void {
  const stx = getFloatingStx()
  const zOrder = stx.data.zOrder.get().filter((pid: string) => pid !== id)
  zOrder.push(id)
  stx.data.zOrder.set(zOrder)

  // Update z-indices
  const panels = new Map(stx.data.panels.get())
  const baseZ = stx.data.baseZIndex.get()

  zOrder.forEach((pid, index) => {
    const panel = panels.get(pid)
    if (panel) {
      panels.set(pid, { ...panel, zIndex: baseZ + index })
    }
  })

  stx.data.panels.set(panels)
}

/**
 * Send panel to back (lowest z-index)
 */
export function sendPanelToBack(id: string): void {
  const stx = getFloatingStx()
  const zOrder = stx.data.zOrder.get().filter((pid: string) => pid !== id)
  zOrder.unshift(id)
  stx.data.zOrder.set(zOrder)

  // Update z-indices
  const panels = new Map(stx.data.panels.get())
  const baseZ = stx.data.baseZIndex.get()

  zOrder.forEach((pid, index) => {
    const panel = panels.get(pid)
    if (panel) {
      panels.set(pid, { ...panel, zIndex: baseZ + index })
    }
  })

  stx.data.panels.set(panels)
}

/**
 * Set panel visibility
 */
export function setPanelVisibility(id: string, visibility: PanelVisibility): void {
  const stx = getFloatingStx()
  const panels = new Map(stx.data.panels.get())
  const panel = panels.get(id)

  if (panel) {
    panels.set(id, { ...panel, visibility })
    stx.data.panels.set(panels)
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
  const stx = getFloatingStx()
  const panels = new Map(stx.data.panels.get())
  const panel = panels.get(id)

  if (panel) {
    const newMode = panel.mode === 'floating' ? 'docked' : 'floating'
    panels.set(id, { ...panel, mode: newMode })
    stx.data.panels.set(panels)
  }
}

/**
 * Update modifier keys state
 */
export function updateModifierKeys(keys: Partial<ModifierKeys>): void {
  const stx = getFloatingStx()
  const current = stx.data.modifierKeys.get()
  stx.data.modifierKeys.set({ ...current, ...keys })
}

/**
 * Set dragging state for a panel
 */
export function setDragging(id: string, isDragging: boolean): void {
  const stx = getFloatingStx()
  const panels = new Map(stx.data.panels.get())
  const panel = panels.get(id)

  if (panel) {
    panels.set(id, { ...panel, isDragging })
    stx.data.panels.set(panels)
  }

  stx.data.draggingPanel.set(isDragging ? id : null)
}

/**
 * Set resizing state for a panel
 */
export function setResizing(id: string, isResizing: boolean): void {
  const stx = getFloatingStx()
  const panels = new Map(stx.data.panels.get())
  const panel = panels.get(id)

  if (panel) {
    panels.set(id, { ...panel, isResizing })
    stx.data.panels.set(panels)
  }

  stx.data.resizingPanel.set(isResizing ? id : null)
}

/**
 * Get panel by ID
 */
export function getPanel(id: string): PanelState | undefined {
  const stx = getFloatingStx()
  return stx.data.panels.get().get(id)
}

/**
 * Restore persisted state and apply to registered panels
 */
export function restorePersistedState(storage: PanelStorage): void {
  const stx = getFloatingStx()
  const panels = new Map(stx.data.panels.get())

  // Update existing panels with persisted state
  for (const [id, persisted] of Object.entries(storage.panels)) {
    const panel = panels.get(id)
    if (panel) {
      panels.set(id, {
        ...panel,
        position: persisted.position,
        dimensions: persisted.dimensions,
        visibility: persisted.visibility,
        mode: persisted.mode,
      })
    }
  }

  stx.data.panels.set(panels)

  // Restore z-order for panels that exist
  const existingIds = new Set(panels.keys())
  const validOrder = storage.order.filter(id => existingIds.has(id))

  // Add any panels not in persisted order
  panels.forEach((_, id) => {
    if (!validOrder.includes(id)) {
      validOrder.push(id)
    }
  })

  stx.data.zOrder.set(validOrder)
}

/**
 * Maximize panel to fullscreen
 * Stores current position/dimensions for restore
 */
export function maximizePanel(id: string): void {
  const stx = getFloatingStx()
  const panels = new Map(stx.data.panels.get())
  const panel = panels.get(id)

  if (!panel || panel.isMaximized) return

  // Store current state for restore
  const fullscreenDimensions: Dimensions = {
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  }

  panels.set(id, {
    ...panel,
    isMaximized: true,
    preMaximizePosition: { ...panel.position },
    preMaximizeDimensions: { ...panel.dimensions },
    position: { x: 0, y: 0 },
    dimensions: fullscreenDimensions,
  })

  stx.data.panels.set(panels)
  bringPanelToFront(id)
}

/**
 * Restore panel from maximized state
 */
export function restorePanel(id: string): void {
  const stx = getFloatingStx()
  const panels = new Map(stx.data.panels.get())
  const panel = panels.get(id)

  if (!panel || !panel.isMaximized) return

  // Restore to pre-maximize state
  panels.set(id, {
    ...panel,
    isMaximized: false,
    position: panel.preMaximizePosition ?? panel.position,
    dimensions: panel.preMaximizeDimensions ?? panel.dimensions,
    preMaximizePosition: undefined,
    preMaximizeDimensions: undefined,
  })

  stx.data.panels.set(panels)
}

// =============================================================================
// Velocity Tracking (for motion blur)
// =============================================================================

/**
 * Start drag velocity tracking
 * Call this on drag start to initialize velocity tracking
 */
export function startDragVelocityTracking(x: number, y: number): void {
  const stx = getFloatingStx()
  stx.data.lastDragPosition.set({ x, y })
  stx.data.lastDragTimestamp.set(performance.now())
  stx.data.dragVelocity.set({ ...initialVelocity })
}

/**
 * Update drag velocity based on new position
 * Call this on drag move to calculate velocity
 */
export function updateDragVelocity(x: number, y: number): void {
  const stx = getFloatingStx()
  const lastPos = stx.data.lastDragPosition.get()
  const lastTime = stx.data.lastDragTimestamp.get()
  const currentVelocity = stx.data.dragVelocity.get()

  if (!lastPos) return

  const now = performance.now()
  const dt = now - lastTime

  // Avoid division by zero and skip if too fast (< 1ms)
  if (dt < 1) return

  // Calculate instantaneous velocity (normalized to ~60fps)
  const rawVelocityX = (x - lastPos.x) / (dt / 16.67)
  const rawVelocityY = (y - lastPos.y) / (dt / 16.67)

  // Apply EMA smoothing
  const smoothedX = VELOCITY_SMOOTHING * rawVelocityX + (1 - VELOCITY_SMOOTHING) * currentVelocity.smoothedX
  const smoothedY = VELOCITY_SMOOTHING * rawVelocityY + (1 - VELOCITY_SMOOTHING) * currentVelocity.smoothedY

  // Calculate magnitude and angle
  const magnitude = Math.sqrt(smoothedX ** 2 + smoothedY ** 2)
  const angle = Math.atan2(smoothedY, smoothedX)

  stx.data.dragVelocity.set({
    x: rawVelocityX,
    y: rawVelocityY,
    smoothedX,
    smoothedY,
    magnitude,
    angle,
  })

  stx.data.lastDragPosition.set({ x, y })
  stx.data.lastDragTimestamp.set(now)
}

/**
 * Stop drag velocity tracking
 * Call this on drag end to reset velocity
 */
export function stopDragVelocityTracking(): void {
  const stx = getFloatingStx()
  stx.data.dragVelocity.set({ ...initialVelocity })
  stx.data.lastDragPosition.set(null)
  stx.data.lastDragTimestamp.set(0)
}

/**
 * Get current drag velocity state
 */
export function getDragVelocity(): DragVelocity {
  const stx = getFloatingStx()
  return stx.data.dragVelocity.get()
}

/**
 * Get motion blur style based on current velocity
 * This is a convenience function that reads from computed
 */
export function getMotionBlurStyle(): {
  filter: string | undefined
  transform: string | undefined
  transition: string
  isActive: boolean
  blurAmount: number
} {
  const stx = getFloatingStx()
  const velocity = stx.data.dragVelocity.get()
  const draggingPanel = stx.data.draggingPanel.get()

  const isActive = draggingPanel !== null && velocity.magnitude > 2

  if (!isActive) {
    return {
      filter: undefined,
      transform: undefined,
      transition: 'filter 0.15s ease-out, transform 0.15s ease-out',
      isActive: false,
      blurAmount: 0,
    }
  }

  // Calculate blur amount (capped at 6px)
  const blurAmount = Math.min(velocity.magnitude * 0.08, 6)

  // Directional stretch for motion smear
  let stretchTransform: string | undefined = undefined
  if (velocity.magnitude > 4) {
    const stretchFactor = Math.min(1 + velocity.magnitude * 0.001, 1.03)
    const angleDeg = (velocity.angle * 180) / Math.PI
    stretchTransform = `rotate(${angleDeg}deg) scaleX(${stretchFactor}) rotate(${-angleDeg}deg)`
  }

  return {
    filter: blurAmount > 0.5 ? `blur(${blurAmount.toFixed(1)}px)` : undefined,
    transform: stretchTransform,
    transition: 'none',
    isActive: true,
    blurAmount,
  }
}
