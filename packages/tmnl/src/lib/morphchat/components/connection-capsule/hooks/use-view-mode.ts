/**
 * useViewMode — Click-to-cycle with blur defocus transition.
 *
 * Reads from viewModeFamily / blurringFamily atoms (per-surface).
 * Survives remounts. Subscribable by other consumers.
 *
 * @module connection-capsule/hooks/use-view-mode
 */

import { useCallback } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { morphChatRegistry } from '../../../atoms/registry'
import type { SurfaceId } from '../../../atoms/surface-atoms'
import { BLUR_MS } from '../constants'
import { nextMode, type ViewMode } from '../view-modes'
import { viewModeFamily, blurringFamily } from '../atoms'

export interface UseViewModeResult {
  viewMode: ViewMode
  blurring: boolean
  cycleMode: () => void
}

export function useViewMode(surfaceId: SurfaceId, enabled: boolean): UseViewModeResult {
  const viewMode = useAtomValue(viewModeFamily(surfaceId))
  const blurring = useAtomValue(blurringFamily(surfaceId))

  const cycleMode = useCallback(() => {
    if (!enabled) return
    morphChatRegistry.set(blurringFamily(surfaceId), true)
    setTimeout(() => {
      morphChatRegistry.update(viewModeFamily(surfaceId), prev => nextMode(prev))
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          morphChatRegistry.set(blurringFamily(surfaceId), false)
        })
      })
    }, BLUR_MS)
  }, [surfaceId, enabled])

  return { viewMode, blurring, cycleMode }
}
