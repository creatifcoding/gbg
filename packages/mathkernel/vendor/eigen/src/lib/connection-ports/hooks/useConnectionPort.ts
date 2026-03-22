/**
 * useConnectionPort Hook
 *
 * Primary hook for consuming connection ports in React components.
 * Provides unified access to stream data with automatic subscription management.
 *
 * Uses effect-atom Result pattern for reactive state handling.
 *
 * @module connection-ports/hooks/useConnectionPort
 */

import { useEffect, useMemo, useCallback } from 'react';
import { useAtomValue, Result } from '@effect-atom/atom-react';
import { Schema } from 'effect';
import {
  createStreamAtoms,
  connectionStatusAtom,
  type StreamAtoms,
} from '../atoms';
import type { StreamStatus } from '../schemas/status';

// =============================================================================
// Hook Options
// =============================================================================

export interface UseConnectionPortOptions<A> {
  /** Schema for decoding stream data */
  schema: Schema.Schema<A>;

  /** Enable replay from durable streams */
  replay?: boolean;

  /** Starting offset for replay */
  fromOffset?: string;

  /** Auto-subscribe on mount */
  autoSubscribe?: boolean;

  /** Keep data on unmount (for remount scenarios) */
  persistData?: boolean;
}

// =============================================================================
// Hook Return Type
// =============================================================================

export interface UseConnectionPortReturn<A> {
  /**
   * Stream data as Result type.
   * Use Result.builder() or Result.match() for state handling.
   *
   * @example
   * ```tsx
   * Result.builder(dataResult)
   *   .onInitial(() => <Loading />)
   *   .onSuccess((data) => <DataView items={data} />)
   *   .onFailure((cause) => <ErrorView cause={cause} />)
   *   .render()
   * ```
   */
  dataResult: Result.Result<readonly A[], unknown>;

  /**
   * Convenience: unwrapped data array (empty if not success).
   * Use dataResult for full state handling.
   */
  data: readonly A[];

  /** Stream status */
  status: StreamStatus;

  /** Last error (if any) */
  error: Error | null;

  /** Current offset (for durable streams) */
  offset: string | null;

  /** Is stream active */
  isActive: boolean;

  /** Is loading/subscribing */
  isLoading: boolean;

  /** Is in waiting state (has previous data but loading new) */
  isWaiting: boolean;

  /** Message count */
  messageCount: number;

  /** Subscribe to stream */
  subscribe: () => Promise<void>;

  /** Unsubscribe (closes stream) */
  unsubscribe: () => void;

  /** Clear accumulated data */
  clear: () => void;

  /** Connection status */
  isConnected: boolean;
}

// =============================================================================
// Atoms Registry (for reuse across components)
// =============================================================================

const streamAtomsRegistry = new Map<string, StreamAtoms<unknown>>();

function getOrCreateStreamAtoms<A>(
  streamId: string,
  options: UseConnectionPortOptions<A>
): StreamAtoms<A> {
  const key = `${streamId}:${options.replay}:${options.fromOffset}`;
  let atoms = streamAtomsRegistry.get(key) as StreamAtoms<A> | undefined;

  if (!atoms) {
    atoms = createStreamAtoms({
      streamId,
      schema: options.schema,
      replay: options.replay,
      fromOffset: options.fromOffset,
    });
    streamAtomsRegistry.set(key, atoms as StreamAtoms<unknown>);
  }

  return atoms;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for consuming a connection port stream.
 *
 * Uses effect-atom Result pattern for proper async state handling:
 * - Initial: Not yet subscribed
 * - Waiting: Loading (may have previous data)
 * - Success: Data available
 * - Failure: Error occurred
 *
 * @example
 * ```tsx
 * const { dataResult, isActive, subscribe } = useConnectionPort(
 *   'tmnl.ava.artifacts.map',
 *   {
 *     schema: MapArtifactSchema,
 *     replay: true,
 *     autoSubscribe: true,
 *   }
 * );
 *
 * return Result.builder(dataResult)
 *   .onInitial(() => <MapSkeleton />)
 *   .onWaiting(() => <MapWithSpinner markers={[]} />)
 *   .onSuccess((markers) => <MapView markers={markers} />)
 *   .onFailure((cause) => <MapError cause={cause} />)
 *   .render();
 * ```
 */
export function useConnectionPort<A>(
  streamId: string,
  options: UseConnectionPortOptions<A>
): UseConnectionPortReturn<A> {
  const { autoSubscribe = false, persistData = false } = options;

  // Get or create stream atoms (stable reference)
  const atoms = useMemo(
    () => getOrCreateStreamAtoms(streamId, options),
    [streamId, options.schema, options.replay, options.fromOffset]
  );

  // Subscribe to atoms reactively via useAtomValue
  // These automatically update when the stream emits
  const data = useAtomValue(atoms.dataAtom) as readonly A[];
  const status = useAtomValue(atoms.statusAtom);
  const error = useAtomValue(atoms.errorAtom);
  const offset = useAtomValue(atoms.offsetAtom);
  const isActive = useAtomValue(atoms.isActiveAtom);
  const messageCount = useAtomValue(atoms.messageCountAtom);

  // Connection status
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const isConnected = connectionStatus.isFullyConnected();

  // Derived states
  const isLoading = status.state === 'subscribing';

  // Build Result from atoms
  const dataResult = useMemo((): Result.Result<readonly A[], unknown> => {
    if (error) {
      // If we have previous data, include it in failure
      if (data.length > 0) {
        return Result.failWithPrevious(error, {
          previous: Result.success(data) as any
        }) as any;
      }
      return Result.fail(error);
    }
    if (status.state === 'idle') {
      return Result.initial();
    }
    if (status.state === 'subscribing') {
      // If we have previous data, mark as waiting with previous
      if (data.length > 0) {
        return Result.waiting(Result.success(data));
      }
      return Result.initial(true); // waiting = true
    }
    return Result.success(data);
  }, [data, error, status.state]);

  // Is waiting (has Result.waiting state)
  const isWaiting = Result.isWaiting(dataResult);

  // Subscribe action
  const subscribe = useCallback(async () => {
    await atoms.subscribe();
  }, [atoms]);

  // Unsubscribe action (currently no-op, stream closes on component unmount)
  const unsubscribe = useCallback(() => {
    // Future: implement proper unsubscription with fiber interruption
  }, []);

  // Clear action
  const clear = useCallback(() => {
    atoms.clear();
  }, [atoms]);

  // Auto-subscribe on mount when conditions are met
  useEffect(() => {
    if (autoSubscribe && isConnected && !isActive && !isLoading) {
      subscribe();
    }
  }, [autoSubscribe, isConnected, isActive, isLoading, subscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!persistData) {
        atoms.clear();
      }
    };
  }, [atoms, persistData]);

  return {
    dataResult,
    data,
    status,
    error,
    offset,
    isActive,
    isLoading,
    isWaiting,
    messageCount,
    subscribe,
    unsubscribe,
    clear,
    isConnected,
  };
}
