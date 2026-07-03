/**
 * Modal System — Reactive Module Store.
 *
 * Uses useSyncExternalStore (React 18+) for state management.
 * Atom.set returns an Effect (not imperative), so we use a simple
 * subscriber-based store that React can synchronously read.
 *
 * Shares the same Rust `update_input_region` command as popovers.
 */

import { BAR_WIDTH, SURFACE_WIDTH } from '../popover/atoms'
import type { ModalEntrance } from './types'

// Re-export bar geometry constants
export { BAR_WIDTH, SURFACE_WIDTH }

// =============================================================================
// Module-Level Store (Synchronous, React-compatible)
// =============================================================================

interface ModalState {
  activeId: string | null
  payload: unknown
  entrance: ModalEntrance
  originRect: { x: number; y: number; w: number; h: number } | null
}

let state: ModalState = {
  activeId: null,
  payload: null,
  entrance: 'slide-right',
  originRect: null,
}

const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

/** Subscribe to state changes (for useSyncExternalStore) */
export function subscribeModal(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Get current snapshot (for useSyncExternalStore) */
export function getModalSnapshot(): ModalState {
  return state
}

// =============================================================================
// Surface Resize + Input Region Sync
// =============================================================================

/** Cached monitor width from get_bar_geometry */
let cachedMonitorWidth: number | null = null

async function getMonitorWidth(): Promise<number> {
  if (cachedMonitorWidth) return cachedMonitorWidth
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const geom = await invoke<{ monitor_width: number }>('get_bar_geometry')
    cachedMonitorWidth = geom.monitor_width
    return cachedMonitorWidth
  } catch {
    return 1645 // fallback
  }
}

/**
 * Version counter for syncModalSurface — prevents async race conditions.
 *
 * Bug: openModal → syncModalSurface(true) fires async, closeModal →
 * syncModalSurface(false) fires async. The dynamic import() in each
 * creates a window where (true) can resolve AFTER (false), leaving
 * the surface permanently expanded (the "chronicle gutter" artifact).
 *
 * Fix: each call increments the version. After every await, bail if
 * a newer call has been issued. Only the latest call wins.
 */
let surfaceVersion = 0

async function syncModalSurface(isOpen: boolean) {
  const version = ++surfaceVersion
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    if (version !== surfaceVersion) return // Stale — newer call in flight

    if (isOpen) {
      const monitorWidth = await getMonitorWidth()
      if (version !== surfaceVersion) return
      await invoke('set_surface_width', { width: monitorWidth })
      if (version !== surfaceVersion) return
      await invoke('update_input_region', {
        regions: [{ x: 0, y: 0, w: monitorWidth, h: 8000 }],
      })
    } else {
      await invoke('set_surface_width', { width: BAR_WIDTH })
      if (version !== surfaceVersion) return
      await invoke('update_input_region', { regions: [] as any[] })
    }
  } catch (e) {
    console.debug('modal surface sync unavailable:', e)
  }
}

/**
 * Defensive surface collapse — call from focus handlers and cleanup effects.
 * If no modal is active, ensures the surface is collapsed.
 */
export function ensureSurfaceCollapsed() {
  if (state.activeId === null) {
    syncModalSurface(false)
  }
}

// =============================================================================
// Shell Log (imperative, fire-and-forget)
// =============================================================================

async function shellLog(level: string, message: string, data?: Record<string, unknown>) {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('shell_log_batch', {
      entries: [{
        timestamp: new Date().toISOString(),
        level,
        message,
        fiber_id: null,
        spans: [],
        annotations: data ? Object.entries(data).map(([k, v]) => `${k}=${JSON.stringify(v)}`) : [],
        source: 'modal',
        cause: null,
      }],
    })
  } catch {
    // Tauri not available (e.g., dev in browser)
  }
}

// =============================================================================
// Operations — Imperative (works outside React + Effect)
// =============================================================================

/**
 * Open a modal by ID with optional payload and entrance style.
 */
export function openModal(
  id: string,
  payload?: unknown,
  entrance: ModalEntrance = 'slide-right',
  originRect?: { x: number; y: number; w: number; h: number },
) {
  // Close any open popovers — dispatch event that Popover components listen to
  window.dispatchEvent(new CustomEvent('tmnl:close-all-popovers'))

  state = {
    activeId: id,
    payload: payload ?? null,
    entrance,
    originRect: originRect ?? null,
  }
  console.warn(`[MODAL] openModal("${id}") — notifying ${listeners.size} listeners`)
  notify()

  syncModalSurface(true).then(() => {
    console.warn(`[MODAL] syncModalSurface(true) complete`)
  }).catch(e => {
    console.error(`[MODAL] syncModalSurface failed:`, e)
  })
  shellLog('INFO', `modal.open(${id})`, { entrance, payload })
}

/**
 * Close the active modal.
 */
export function closeModal() {
  const prevId = state.activeId

  state = {
    activeId: null,
    payload: null,
    entrance: state.entrance,
    originRect: null,
  }
  notify()

  syncModalSurface(false)
  if (prevId) {
    shellLog('INFO', `modal.close(${prevId})`)
  }
}
