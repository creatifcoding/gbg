/**
 * TransferBusProvider — Context provider for cross-surface transfer.
 *
 * Registers surfaces on mount, syncs activeDrag for the overlay system.
 * Wraps children with RegistryProvider if one isn't already present.
 *
 * @since v2
 */
import React, { useEffect, useContext, type ReactNode } from 'react'
import { RegistryContext, useAtomValue } from '@effect-atom/atom-react'
import { activeDragAtom, registeredSurfacesAtom } from './TransferBus'
import type { TransferSession } from './schemas'

// ── Context ──────────────────────────────────────────────────

export interface TransferBusContextValue {
  /** Currently active drag session (from any surface) */
  readonly activeDrag: TransferSession | null
  /** All registered surface IDs */
  readonly surfaces: ReadonlySet<string>
}

const TransferBusContext = React.createContext<TransferBusContextValue>({
  activeDrag: null,
  surfaces: new Set(),
})

export const useTransferBus = () => useContext(TransferBusContext)

// ── Provider ─────────────────────────────────────────────────

interface TransferBusProviderProps {
  children: ReactNode
}

export function TransferBusProvider({ children }: TransferBusProviderProps) {
  const activeDrag = useAtomValue(activeDragAtom)
  const surfaces = useAtomValue(registeredSurfacesAtom)

  const value = React.useMemo<TransferBusContextValue>(
    () => ({ activeDrag, surfaces }),
    [activeDrag, surfaces],
  )

  return (
    <TransferBusContext.Provider value={value}>
      {children}
    </TransferBusContext.Provider>
  )
}
