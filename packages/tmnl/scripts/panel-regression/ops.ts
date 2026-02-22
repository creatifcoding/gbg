/**
 * Atomic panel operations catalog.
 *
 * Each op maps to one or more agent-browser key presses.
 * Compose these into scenarios for combinatorial testing.
 *
 * @module panel-regression/ops
 */

import type { Op, Checkpoint } from './types'

// ─── Panel Lifecycle ─────────────────────────────────────────────────────────

export const spawn: Op = {
  tag: 'spawn',
  label: 'Spawn panel (Alt+Enter)',
  keys: ['Alt+Enter'],
  wait: 300,
}

export const close: Op = {
  tag: 'close',
  label: 'Close panel (Alt+Q)',
  keys: ['Alt+q'],
  wait: 200,
}

// ─── Splits ──────────────────────────────────────────────────────────────────

export const vsplit: Op = {
  tag: 'vsplit',
  label: 'Vertical split (Alt+_)',
  keys: ['Alt+_'],
  wait: 300,
}

export const hsplit: Op = {
  tag: 'hsplit',
  label: 'Horizontal split (Alt+-)',
  keys: ['Alt+-'],
  wait: 300,
}

// ─── Focus Navigation ───────────────────────────────────────────────────────

export const focusLeft: Op = {
  tag: 'focus-left',
  label: 'Focus left (Alt+H)',
  keys: ['Alt+h'],
}

export const focusRight: Op = {
  tag: 'focus-right',
  label: 'Focus right (Alt+L)',
  keys: ['Alt+l'],
}

export const focusUp: Op = {
  tag: 'focus-up',
  label: 'Focus up (Alt+K)',
  keys: ['Alt+k'],
}

export const focusDown: Op = {
  tag: 'focus-down',
  label: 'Focus down (Alt+J)',
  keys: ['Alt+j'],
}

// ─── Swap ────────────────────────────────────────────────────────────────────

export const swapLeft: Op = {
  tag: 'swap-left',
  label: 'Swap left (Alt+Shift+H)',
  keys: ['Alt+Shift+h'],
}

export const swapRight: Op = {
  tag: 'swap-right',
  label: 'Swap right (Alt+Shift+L)',
  keys: ['Alt+Shift+l'],
}

export const swapUp: Op = {
  tag: 'swap-up',
  label: 'Swap up (Alt+Shift+K)',
  keys: ['Alt+Shift+k'],
}

export const swapDown: Op = {
  tag: 'swap-down',
  label: 'Swap down (Alt+Shift+J)',
  keys: ['Alt+Shift+j'],
}

// ─── Collapse / Expand ──────────────────────────────────────────────────────

export const collapse: Op = {
  tag: 'collapse',
  label: 'Collapse focused (Alt+W)',
  keys: ['Alt+w'],
}

// ─── Width ──────────────────────────────────────────────────────────────────

export const widthCycle: Op = {
  tag: 'width-cycle',
  label: 'Cycle column width (Alt+D)',
  keys: ['Alt+d'],
}

// ─── Mode ───────────────────────────────────────────────────────────────────

export const maximize: Op = {
  tag: 'maximize',
  label: 'Maximize panel (Alt+F)',
  keys: ['Alt+f'],
}

export const floatPanel: Op = {
  tag: 'float',
  label: 'Float panel (Alt+Shift+F)',
  keys: ['Alt+Shift+f'],
  wait: 300,
}

// ─── Overlay ────────────────────────────────────────────────────────────────

export const toggleOverlay: Op = {
  tag: 'toggle-overlay',
  label: 'Toggle panel overlay (Alt+P)',
  keys: ['Alt+p'],
  wait: 500,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Repeat an op N times */
export function repeat(op: Op, n: number): Op[] {
  return Array.from({ length: n }, () => op)
}

/** Create a checkpoint */
export function checkpoint(name: string, description?: string): Checkpoint {
  return { _type: 'checkpoint', name, description }
}

/** Navigate to a specific panel by direction sequence */
export function navigate(...dirs: ('left' | 'right' | 'up' | 'down')[]): Op[] {
  const dirMap = { left: focusLeft, right: focusRight, up: focusUp, down: focusDown }
  return dirs.map(d => dirMap[d])
}

/** Collapse N panels by navigating and collapsing */
export function collapseSequence(navOps: Op[]): Op[] {
  const result: Op[] = []
  for (let i = 0; i < navOps.length; i++) {
    if (i > 0) result.push(navOps[i])
    result.push(collapse)
  }
  // First collapse doesn't need nav (already focused)
  if (navOps.length === 0) result.push(collapse)
  return result
}

// ─── All ops for fuzzing ────────────────────────────────────────────────────

export const ALL_OPS = {
  spawn, close, vsplit, hsplit,
  focusLeft, focusRight, focusUp, focusDown,
  swapLeft, swapRight, swapUp, swapDown,
  collapse, widthCycle, maximize, floatPanel,
} as const

export type OpTag = keyof typeof ALL_OPS
