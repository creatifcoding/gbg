/**
 * Connection Ports Provider
 *
 * Provider for connection ports services. Manages connection lifecycle
 * and exposes operations for stream subscriptions.
 *
 * Architecture:
 * - Uses connectionBusRuntimeAtom for Effect runtime
 * - Operations exposed via context (no state subscriptions in provider)
 * - Consumers subscribe directly to atoms for reactive state
 *
 * @module connection-ports/providers
 */

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import { Schema } from 'effect';
import { connectionOps } from '../atoms';
import type { StreamAtomsConfig, StreamAtoms } from '../atoms';
import { createStreamAtoms } from '../atoms';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for creating a stream subscription.
 */
export interface CreateStreamOptions<A> {
  /** Stream identifier (NATS subject or durable stream URL) */
  readonly streamId: string;

  /** Schema for decoding stream data */
  readonly schema: Schema.Schema<A>;

  /** Enable replay from durable streams */
  readonly replay?: boolean;

  /** Starting offset for replay */
  readonly fromOffset?: string;
}

/**
 * Context value exposed by ConnectionPortsProvider.
 *
 * PERF NOTE: State accessors removed. Consumers should subscribe
 * directly to atoms to avoid provider re-renders.
 * Use: useAtomValue(connectionStatusAtom), useAtomValue(isConnectedAtom)
 */
export interface ConnectionPortsContextValue {
  // ─── Lifecycle ──────────────────────────────────────────────
  /** Connect to all ports */
  connect: () => Promise<void>;

  /** Disconnect from all ports */
  disconnect: () => Promise<void>;

  /** Refresh connection status */
  refreshStatus: () => Promise<void>;

  // ─── Stream Operations ──────────────────────────────────────
  /** Create stream atoms for a subscription */
  createStream: <A>(options: CreateStreamOptions<A>) => StreamAtoms<A>;
}

const ConnectionPortsContext = createContext<ConnectionPortsContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

export interface ConnectionPortsProviderProps {
  /** Child components */
  children: ReactNode;

  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;

  /** Disconnect on unmount (default: true) */
  disconnectOnUnmount?: boolean;
}

/**
 * ConnectionPortsProvider
 *
 * Provider for connection ports services. Wrap your app root
 * with this provider to enable connection ports throughout the tree.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ConnectionPortsProvider autoConnect>
 *       <RouterProvider router={router} />
 *     </ConnectionPortsProvider>
 *   )
 * }
 * ```
 *
 * @example With manual connection control
 * ```tsx
 * function App() {
 *   return (
 *     <ConnectionPortsProvider autoConnect={false}>
 *       <ConnectionManager />
 *       <Content />
 *     </ConnectionPortsProvider>
 *   )
 * }
 *
 * function ConnectionManager() {
 *   const { connect, disconnect } = useConnectionPorts()
 *   const isConnected = useAtomValue(isConnectedAtom)
 *
 *   return (
 *     <button onClick={isConnected ? disconnect : connect}>
 *       {isConnected ? 'Disconnect' : 'Connect'}
 *     </button>
 *   )
 * }
 * ```
 */
export function ConnectionPortsProvider({
  children,
  autoConnect = true,
  disconnectOnUnmount = true,
}: ConnectionPortsProviderProps) {
  // ─── Lifecycle Operations ─────────────────────────────────────

  /**
   * Connect to all ports.
   */
  const connect = useCallback(async (): Promise<void> => {
    await connectionOps.connect();
  }, []);

  /**
   * Disconnect from all ports.
   */
  const disconnect = useCallback(async (): Promise<void> => {
    await connectionOps.disconnect();
  }, []);

  /**
   * Refresh connection status.
   */
  const refreshStatus = useCallback(async (): Promise<void> => {
    await connectionOps.refreshStatus();
  }, []);

  // ─── Stream Operations ────────────────────────────────────────

  /**
   * Create stream atoms for a subscription.
   * Returns atoms that can be used with useAtomValue for reactive updates.
   */
  const createStream = useCallback(<A,>(options: CreateStreamOptions<A>): StreamAtoms<A> => {
    return createStreamAtoms({
      streamId: options.streamId,
      schema: options.schema,
      replay: options.replay,
      fromOffset: options.fromOffset,
    });
  }, []);

  // ─── Lifecycle Effects ────────────────────────────────────────

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
  }, [autoConnect, connect]);

  // Disconnect on unmount
  useEffect(() => {
    return () => {
      if (disconnectOnUnmount) {
        disconnect();
      }
    };
  }, [disconnectOnUnmount, disconnect]);

  // ─── Context Value ────────────────────────────────────────────
  // PERF: All useCallbacks have [] deps, so value is stable.
  // No state subscriptions means provider never re-renders children.

  const value = useMemo(
    (): ConnectionPortsContextValue => ({
      connect,
      disconnect,
      refreshStatus,
      createStream,
    }),
    [connect, disconnect, refreshStatus, createStream]
  );

  return (
    <ConnectionPortsContext.Provider value={value}>
      {children}
    </ConnectionPortsContext.Provider>
  );
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Access connection ports context.
 *
 * @throws Error if used outside ConnectionPortsProvider
 *
 * @example
 * ```tsx
 * function StreamConsumer() {
 *   const { createStream } = useConnectionPorts()
 *   const isConnected = useAtomValue(isConnectedAtom)
 *
 *   const streamAtoms = useMemo(
 *     () => createStream({
 *       streamId: 'tmnl.events.updates',
 *       schema: UpdateEventSchema,
 *       replay: true,
 *     }),
 *     [createStream]
 *   )
 *
 *   useEffect(() => {
 *     if (isConnected) {
 *       streamAtoms.subscribe()
 *     }
 *   }, [isConnected, streamAtoms])
 *
 *   const data = useAtomValue(streamAtoms.dataAtom)
 *   // ...
 * }
 * ```
 */
export function useConnectionPorts(): ConnectionPortsContextValue {
  const context = useContext(ConnectionPortsContext);
  if (!context) {
    throw new Error(
      'useConnectionPorts must be used within ConnectionPortsProvider'
    );
  }
  return context;
}

/**
 * Safe version that returns null when no provider exists.
 * Use this for components that should gracefully no-op without provider.
 */
export function useConnectionPortsSafe(): ConnectionPortsContextValue | null {
  return useContext(ConnectionPortsContext);
}

// =============================================================================
// Exports
// =============================================================================

export { ConnectionPortsContext };
