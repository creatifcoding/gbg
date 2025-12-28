/**
 * useStreamSubscription Hook
 *
 * Low-level hook for direct stream subscription management.
 * Use useConnectionPort for most use cases.
 *
 * @module connection-ports/hooks/useStreamSubscription
 */

import { useCallback, useMemo } from 'react';
import { useAtomValue, Atom, Result } from '@effect-atom/atom-react';
import { Effect, Stream, Schema } from 'effect';
import {
  connectionBusRuntimeAtom,
  connectionStatusAtom,
  createStreamAtoms,
  type StreamAtoms,
} from '../atoms';
import type { StreamStatus } from '../schemas/status';

// =============================================================================
// Hook Options
// =============================================================================

export interface UseStreamSubscriptionOptions<A> {
  /** Schema for decoding stream data */
  schema: Schema.Schema<A>;

  /** Enable replay from durable streams */
  replay?: boolean;

  /** Starting offset for replay */
  fromOffset?: string;

  /** Auto-start subscription on mount */
  autoStart?: boolean;

  /** Max messages to buffer (0 = unlimited) */
  maxBuffer?: number;
}

// =============================================================================
// Hook Return Type
// =============================================================================

export interface UseStreamSubscriptionReturn<A> {
  /** All accumulated data as Result (handles loading/error states) */
  dataResult: Result.Result<readonly A[], unknown>;

  /** Is subscription active */
  isActive: boolean;

  /** Is in loading/subscribing state */
  isLoading: boolean;

  /** Message count since subscription start */
  messageCount: number;

  /** Stream status */
  status: StreamStatus;

  /** Start subscription (async, returns void) */
  subscribe: () => Promise<void>;

  /** Clear buffer */
  clear: () => void;

  /** Connection status */
  isConnected: boolean;
}

// =============================================================================
// Stream Atoms Registry (for reuse across components)
// =============================================================================

const streamAtomsRegistry = new Map<string, StreamAtoms<unknown>>();

function getOrCreateStreamAtoms<A>(
  streamId: string,
  options: UseStreamSubscriptionOptions<A>
): StreamAtoms<A> {
  const key = `${streamId}:${options.replay ?? false}:${options.fromOffset ?? 'earliest'}`;
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
 * Low-level hook for stream subscription.
 *
 * Uses effect-atom Result pattern for reactive state management.
 * The dataResult contains Initial | Waiting | Success | Failure states.
 *
 * @example
 * ```tsx
 * const { dataResult, isActive, subscribe } = useStreamSubscription(
 *   'tmnl.events.updates',
 *   {
 *     schema: UpdateEventSchema,
 *     autoStart: true,
 *   }
 * );
 *
 * return Result.builder(dataResult)
 *   .onInitial(() => <Loading />)
 *   .onSuccess((data) => <EventList events={data} />)
 *   .onFailure((cause) => <Error message={Cause.pretty(cause)} />)
 *   .render();
 * ```
 */
export function useStreamSubscription<A>(
  streamId: string,
  options: UseStreamSubscriptionOptions<A>
): UseStreamSubscriptionReturn<A> {
  // Get or create stream atoms (stable across renders)
  const atoms = useMemo(
    () => getOrCreateStreamAtoms(streamId, options),
    [streamId, options.schema, options.replay, options.fromOffset]
  );

  // Subscribe to atoms reactively via useAtomValue
  // These automatically update when the stream emits
  const data = useAtomValue(atoms.dataAtom) as readonly A[];
  const status = useAtomValue(atoms.statusAtom);
  const error = useAtomValue(atoms.errorAtom);
  const isActive = useAtomValue(atoms.isActiveAtom);
  const messageCount = useAtomValue(atoms.messageCountAtom);

  // Connection status
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const isConnected = connectionStatus.isFullyConnected();

  // Is loading (subscribing or waiting state)
  const isLoading = status.state === 'subscribing';

  // Build Result from atoms (Initial | Success | Failure)
  const dataResult = useMemo((): Result.Result<readonly A[], unknown> => {
    if (error) {
      return Result.fail(error);
    }
    if (status.state === 'idle') {
      return Result.initial();
    }
    if (status.state === 'subscribing') {
      return Result.initial(true); // waiting = true
    }
    return Result.success(data);
  }, [data, error, status.state]);

  // Subscribe action - triggers the stream subscription
  const subscribe = useCallback(async () => {
    await atoms.subscribe();
  }, [atoms]);

  // Clear action
  const clear = useCallback(() => {
    atoms.clear();
  }, [atoms]);

  return {
    dataResult,
    isActive,
    isLoading,
    messageCount,
    status,
    subscribe,
    clear,
    isConnected,
  };
}
