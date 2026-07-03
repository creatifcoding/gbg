/**
 * Popover System — Atom-as-State.
 *
 * Tracks all active popovers and syncs input regions to Rust.
 */

import { Atom } from '@effect-atom/atom-react'
import { logPopoverOpenFn, logPopoverCloseFn, logInputRegionFn } from '../atoms'

/** Map of popover ID → rect. Multiple popovers can be open. */
export const activePopoversAtom = Atom.make<
  ReadonlyMap<string, { x: number; y: number; w: number; h: number }>
>(new Map())

/** Bar strip width — must match Rust side. */
export const BAR_WIDTH = 48

/** Total surface width (must match Rust side). */
export const SURFACE_WIDTH = 400

/** Sync active popover rects to Rust input region.
 *
 * When ANY popover is open, we send a single full-surface rect
 * so the entire overlay zone receives pointer events.
 * This lets the transparent click-catcher backdrop fire dismiss.
 * When no popovers are open, we send an empty array and Rust
 * falls back to bar-strip-only input region.
 */
async function syncInputRegion(
  popovers: ReadonlyMap<string, { x: number; y: number; w: number; h: number }>
) {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    if (popovers.size > 0) {
      // Expand only while a popover is open. The persistent shell must remain
      // a true 48px sidebar; DriftWM does not tolerate a fake transparent slab.
      await invoke('set_surface_width', { width: SURFACE_WIDTH })
      await invoke('update_input_region', {
        regions: [{ x: 0, y: 0, w: SURFACE_WIDTH, h: 8000 }],
      })
    } else {
      // No popovers — collapse back to the real bar strip.
      await invoke('set_surface_width', { width: BAR_WIDTH })
      await invoke('update_input_region', { regions: [] as any[] })
    }
  } catch (e) {
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
  // Fire-and-forget log via atom fn
  Atom.set(logPopoverOpenFn, { id, rect })
  Atom.set(logInputRegionFn, {
    reason: `popover.open(${id})`,
    regionCount: next.size,
    fullSurface: next.size > 0,
  })
}

/** Unregister a popover and sync to Rust. */
export function closePopover(id: string) {
  const current = Atom.get(activePopoversAtom)
  const next = new Map(current)
  next.delete(id)
  Atom.set(activePopoversAtom, next)
  syncInputRegion(next)
  Atom.set(logPopoverCloseFn, { id })
  Atom.set(logInputRegionFn, {
    reason: `popover.close(${id})`,
    regionCount: next.size,
    fullSurface: next.size > 0,
  })
}

/** Close all popovers. */
export function closeAllPopovers() {
  const prev = Atom.get(activePopoversAtom)
  Atom.set(activePopoversAtom, new Map())
  syncInputRegion(new Map())
  if (prev.size > 0) {
    Atom.set(logPopoverCloseFn, { id: `all(${prev.size})` })
    Atom.set(logInputRegionFn, {
      reason: 'popover.closeAll',
      regionCount: 0,
      fullSurface: false,
    })
  }
}
