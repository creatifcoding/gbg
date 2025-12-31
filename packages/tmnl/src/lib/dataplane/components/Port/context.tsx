import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import type { PortSize } from './types';
import {
  getOrCreatePortActor,
  disposePortActor,
  sendPortEvent,
  type PortMachineEvent,
} from './port-stx';

/**
 * Port Context
 *
 * Provides scoped access to port state machine actor and configuration.
 * Each Port component tree gets its own actor instance keyed by portId.
 *
 * Pattern: Follows DynamicIsland.tsx compound component architecture
 */

interface PortContextValue {
  readonly portId: string;
  readonly size: PortSize;
  readonly send: (event: PortMachineEvent) => void;
}

const PortContext = createContext<PortContextValue | null>(null);

interface PortProviderProps {
  readonly portId: string;
  readonly size: PortSize;
  readonly children: ReactNode;
}

/**
 * PortProvider
 *
 * Initializes and manages the lifecycle of a port's XState actor.
 * - Creates/retrieves actor on mount via getOrCreatePortActor
 * - Disposes actor on unmount via disposePortActor
 * - Provides portId, size, and send function to descendants
 */
export function PortProvider({ portId, size, children }: PortProviderProps) {
  // Initialize actor on mount, dispose on unmount
  useEffect(() => {
    const actor = getOrCreatePortActor(portId);
    actor.start();

    return () => {
      disposePortActor(portId);
    };
  }, [portId]);

  const contextValue = useMemo<PortContextValue>(
    () => ({
      portId,
      size,
      send: (event: PortMachineEvent) => sendPortEvent(portId, event),
    }),
    [portId, size]
  );

  return (
    <PortContext.Provider value={contextValue}>{children}</PortContext.Provider>
  );
}

/**
 * usePort
 *
 * Primary hook for accessing port context.
 * Throws if used outside PortProvider.
 */
export function usePort(): PortContextValue {
  const context = useContext(PortContext);
  if (!context) {
    throw new Error('usePort must be used within a PortProvider');
  }
  return context;
}

/**
 * usePortContext
 *
 * Alias for usePort, matches DynamicIsland naming pattern.
 */
export const usePortContext = usePort;
