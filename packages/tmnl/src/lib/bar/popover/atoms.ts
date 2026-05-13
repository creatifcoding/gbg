/**
 * Popover System — Atom-as-State.
 *
 * Tracks all active popovers and syncs input regions to Rust.
 */

import { Atom } from '@effect-atom/atom-react'

/** Map of popover ID → rect. Multiple popovers can be open. */
export const activePopoversAtom = Atom.make<
  ReadonlyMap<string, { x: number; y: number; w: number; h: number }>
>(new Map())

/** Bar strip width — must match Rust side. */
export const BAR_WIDTH = 48

/** Sync active popover rects to Rust input region. */
async function syncInputRegion(
  popovers: ReadonlyMap<string, { x: number; y: number; w: number; h: number }>
) {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const regions = Array.from(popovers.values())
    await invoke('update_input_region', { regions })
  } catch (e) {
    // Tauri not available (dev mode in browser, etc.)
    console.debug('update_input_region unavailable:', e)
  }
}

/** Register a popover's rect and sync to Rust. */
export function openPopover(
  id: string,
  rect: { x: number; y: number; w: number; h: number }
) {
  const current = Atom.get(activePopoversAtom)
  const next = new Map(current)
  next.set(id, rect)
  Atom.set(activePopoversAtom, next)
  syncInputRegion(next)
}

/** Unregister a popover and sync to Rust. */
export function closePopover(id: string) {
  const current = Atom.get(activePopoversAtom)
  const next = new Map(current)
  next.delete(id)
  Atom.set(activePopoversAtom, next)
  syncInputRegion(next)
}

/** Close all popovers. */
export function closeAllPopovers() {
  Atom.set(activePopoversAtom, new Map())
  syncInputRegion(new Map())
}
