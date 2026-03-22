/**
 * Auto-Collapse Hook
 *
 * Listens to the surface machine's 'surface.autoCollapse' emitted event
 * and sets a global atom flag. Thinking and tool blocks read this to
 * auto-close their expanded content after streaming finishes.
 *
 * @module morphchat/hooks/useAutoCollapse
 */

import * as React from 'react'
import { Atom } from '@effect-atom/atom'
import { morphChatRegistry } from '../atoms/registry'
import { getSurfaceActor } from '../machines/surface-stx'
import type { SurfaceId } from '../atoms/surface-atoms'

// =============================================================================
// Auto-collapse trigger atom (per surface)
// =============================================================================

/**
 * When set to a timestamp, all collapsible blocks should close.
 * Blocks check: if collapseAt > their mount time, collapse.
 */
export const autoCollapseTriggerFamily = Atom.family((surfId: SurfaceId) => {
  const atom = Atom.make<number>(0)
  morphChatRegistry.mount(atom)
  return atom
})

// =============================================================================
// Hook — wire in surface-root
// =============================================================================

export function useAutoCollapse(surfaceId: SurfaceId): void {
  React.useEffect(() => {
    const actor = getSurfaceActor(surfaceId)
    if (!actor) return

    const sub = actor.on('surface.autoCollapse', () => {
      morphChatRegistry.set(autoCollapseTriggerFamily(surfaceId), Date.now())
    })

    return () => sub.unsubscribe()
  }, [surfaceId])
}
