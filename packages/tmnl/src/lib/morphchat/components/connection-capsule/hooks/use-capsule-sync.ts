/**
 * useCapsuleSync — Subscribe to connection$ and sync all derived atoms.
 *
 * Single subscription point. Runs syncCapsuleAtoms on every connection$ change.
 * Mount this once in the ConnectionCapsule orchestrator.
 *
 * @module connection-capsule/hooks/use-capsule-sync
 */

import { useEffect } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import type { Atom } from '@effect-atom/atom'
import type { ConnectionState } from '../../../schemas/message-types'
import type { SurfaceId } from '../../../atoms/surface-atoms'
import { syncCapsuleAtoms } from '../atoms'

export function useCapsuleSync(
  connection$: Atom.Atom<ConnectionState>,
  surfaceId: SurfaceId,
): void {
  const connection = useAtomValue(connection$)

  useEffect(() => {
    syncCapsuleAtoms(surfaceId, connection)
  }, [surfaceId, connection])
}
