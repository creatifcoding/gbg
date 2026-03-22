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
 * Provides scoped access to port state machine via React context.
 *
 * NOTE: Actor lifecycle is managed by portSnapshotAtom, NOT this provider.
 * The atom creates the actor on first access and sets up the subscription.
 * This provider only supplies the portId and size to descendants.
 *
 * Previously, this provider called getOrCreatePortActor/disposePortActor,
 * but React StrictMode's double-mount caused actor disposal issues:
 * subscriptions were set up on the first actor, then it was disposed,
 * and a new actor was created - causing events to go to the wrong actor.
 */
export function PortProvider({ portId, size, children }: PortProviderProps) {
  // Actor lifecycle is now managed by portSnapshotAtom
  // This provider only supplies context to descendants

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
