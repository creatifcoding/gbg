/**
 * Tauri Window Manager Atoms
 *
 * Effect-Atom state for tracking open windows and current window context.
 *
 * @module lib/tauri-windows/manager/atoms
 */

import { Atom, Registry } from '@effect-atom/atom'
import type { WindowInfo } from './service'

// Type helper for derived atoms
type AtomGetter = <T>(atom: Atom.Atom<T>) => T

// =============================================================================
// Registry
// =============================================================================

/**
 * Module-level registry for window manager atoms.
 * Used for synchronous mutations in React callbacks.
 */
export const windowManagerRegistry = Registry.make()

// =============================================================================
// State Atoms
// =============================================================================

/**
 * Map of all open windows by label
 */
export const openWindowsAtom = Atom.make<Map<string, WindowInfo>>(new Map())

/**
 * Current window's label (for the window this code is running in)
 */
export const currentWindowLabelAtom = Atom.make<string>('main')

/**
 * Whether this is the main window
 */
export const isMainWindowAtom = Atom.make<boolean>(true)

/**
 * Navigated testbed ID (set by pool navigation events)
 * Used by pooled windows to know which testbed to render.
 */
export const navigatedTestbedAtom = Atom.make<string | null>(null)

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * List of all open windows as an array
 */
export const windowListAtom = Atom.make((get: AtomGetter) => {
  const windows = get(openWindowsAtom)
  return Array.from(windows.values())
})

/**
 * Count of open windows
 */
export const windowCountAtom = Atom.make((get: AtomGetter) => {
  const windows = get(openWindowsAtom)
  return windows.size
})

/**
 * List of open testbed windows (excluding main)
 */
export const testbedWindowsAtom = Atom.make((get: AtomGetter) => {
  const windows = get(openWindowsAtom)
  return Array.from(windows.values()).filter((w: WindowInfo) => w.testbed_id !== null)
})

/**
 * Get a specific window's info
 */
export function getWindowInfoAtom(label: string) {
  return Atom.make((get: AtomGetter) => {
    const windows = get(openWindowsAtom)
    return windows.get(label)
  })
}

/**
 * Check if a testbed window is open
 */
export function isTestbedOpenAtom(testbedId: string) {
  return Atom.make((get: AtomGetter) => {
    const windows = get(openWindowsAtom)
    const label = `testbed-${testbedId}`
    return windows.has(label)
  })
}

// =============================================================================
// Operations
// =============================================================================

/**
 * Update the windows map (called when receiving window:list-changed event)
 */
export function updateWindowsList(windows: readonly WindowInfo[]): void {
  const map = new Map<string, WindowInfo>()
  for (const w of windows) {
    map.set(w.label, w)
  }
  windowManagerRegistry.set(openWindowsAtom, map)
}

/**
 * Add a single window to the map
 */
export function addWindow(info: WindowInfo): void {
  const current = windowManagerRegistry.get(openWindowsAtom)
  const next = new Map(current)
  next.set(info.label, info)
  windowManagerRegistry.set(openWindowsAtom, next)
}

/**
 * Remove a window from the map
 */
export function removeWindow(label: string): void {
  const current = windowManagerRegistry.get(openWindowsAtom)
  const next = new Map(current)
  next.delete(label)
  windowManagerRegistry.set(openWindowsAtom, next)
}

/**
 * Set the current window label (called on window initialization)
 */
export function setCurrentWindowLabel(label: string): void {
  windowManagerRegistry.set(currentWindowLabelAtom, label)
  windowManagerRegistry.set(isMainWindowAtom, label === 'main')
}

/**
 * Set the navigated testbed (called from pool navigation events)
 */
export function setNavigatedTestbed(testbedId: string | null): void {
  windowManagerRegistry.set(navigatedTestbedAtom, testbedId)
}
