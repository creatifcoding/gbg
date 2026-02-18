/**
 * Per-Surface UI Atoms (Family Pattern)
 *
 * Each MorphChat surface instance gets its own set of UI atoms,
 * keyed by surfaceId. This allows multiple surfaces to coexist
 * without state cross-talk.
 *
 * Pattern: Atom.family() — same as morph-card's cardStateFamily
 *
 * @module morphchat/atoms/surface-atoms
 */

import { Atom } from '@effect-atom/atom'
import type { ChatSurfaceSpec } from '../schemas/surface-spec'
import { morphChatRegistry } from './registry'

// =============================================================================
// Surface ID
// =============================================================================

/** Branded surface ID for type safety */
export type SurfaceId = string & { readonly __brand: 'SurfaceId' }

export function surfaceId(id: string): SurfaceId {
  return id as SurfaceId
}

// =============================================================================
// Per-Surface UI State
// =============================================================================

/**
 * Active spec atom — the current ChatSurfaceSpec driving this surface.
 * Mutated when the surface morphs to a different preset.
 */
export const activeSpecFamily = Atom.family((id: SurfaceId) => {
  const atom = Atom.make<ChatSurfaceSpec | null>(null)
  morphChatRegistry.mount(atom)
  return atom
})

/**
 * Previous spec atom — the spec before the last morph transition.
 * Used by the transition animation system.
 */
export const previousSpecFamily = Atom.family((id: SurfaceId) => {
  const atom = Atom.make<ChatSurfaceSpec | null>(null)
  morphChatRegistry.mount(atom)
  return atom
})

/**
 * Whether the surface is currently morphing between specs.
 */
export const isMorphingFamily = Atom.family((id: SurfaceId) => {
  const atom = Atom.make(false)
  morphChatRegistry.mount(atom)
  return atom
})

/**
 * Whether the surface's composer is focused.
 */
export const composerFocusedFamily = Atom.family((id: SurfaceId) => {
  const atom = Atom.make(false)
  morphChatRegistry.mount(atom)
  return atom
})

/**
 * Scroll position state for the thread.
 */
export const scrollPositionFamily = Atom.family((id: SurfaceId) => {
  const atom = Atom.make<{ top: number; isAtBottom: boolean }>({
    top: 0,
    isAtBottom: true,
  })
  morphChatRegistry.mount(atom)
  return atom
})

/**
 * ID of the message currently focused/selected (keyboard nav, click).
 */
export const focusedMessageFamily = Atom.family((id: SurfaceId) => {
  const atom = Atom.make<string | null>(null)
  morphChatRegistry.mount(atom)
  return atom
})

/**
 * Set of selected message IDs (multi-select for transfer, etc.).
 */
export const selectedMessagesFamily = Atom.family((id: SurfaceId) => {
  const atom = Atom.make<ReadonlySet<string>>(new Set())
  morphChatRegistry.mount(atom)
  return atom
})

/**
 * Whether the inline task panel is expanded (when inlineTasks === 'compact').
 */
export const taskPanelExpandedFamily = Atom.family((id: SurfaceId) => {
  const atom = Atom.make(false)
  morphChatRegistry.mount(atom)
  return atom
})

/**
 * Active agent ID (when agent selector is visible).
 */
export const activeAgentFamily = Atom.family((id: SurfaceId) => {
  const atom = Atom.make<string | null>(null)
  morphChatRegistry.mount(atom)
  return atom
})

/**
 * Surface error state (UI-level errors, not connection errors).
 */
export const surfaceErrorFamily = Atom.family((id: SurfaceId) => {
  const atom = Atom.make<string | null>(null)
  morphChatRegistry.mount(atom)
  return atom
})
