/**
 * useSurfaceMachine — XState Actor Hook
 *
 * Provides direct access to the surface's XState machine actor
 * and reactive snapshot/state values.
 *
 * @module morphchat/hooks/useSurfaceMachine
 */

import { useAtomValue } from '@effect-atom/atom-react'
import { useMorphChatContext } from '../components/surface-context'
import {
  surfaceSnapshotFamily,
  surfaceStateValueFamily,
  sendSurfaceEvent,
} from '../machines/surface-stx'
import type { SurfaceMachineEvent } from '../machines/surface-machine'
import { useCallback } from 'react'

/**
 * Access the XState machine for the current surface.
 *
 * ```tsx
 * const { stateValue, send } = useSurfaceMachine()
 * // stateValue: 'idle' | 'active' | 'morphing' | 'error'
 * ```
 */
export function useSurfaceMachine() {
  const { surfaceId, actor } = useMorphChatContext()

  const snapshot = useAtomValue(surfaceSnapshotFamily(surfaceId))
  const stateValue = useAtomValue(surfaceStateValueFamily(surfaceId))

  const send = useCallback(
    (event: SurfaceMachineEvent) => {
      sendSurfaceEvent(surfaceId, event)
    },
    [surfaceId],
  )

  return {
    actor,
    snapshot,
    stateValue,
    send,
    surfaceId,
  }
}
