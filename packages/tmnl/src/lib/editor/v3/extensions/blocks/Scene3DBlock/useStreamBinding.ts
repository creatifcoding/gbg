/**
 * Scene3DBlock Stream Binding Hook
 *
 * Connects Scene3D entities to ConnectionPorts for streaming
 * entity updates from AVA via NATS/Durable Streams.
 *
 * @module editor/v3/extensions/blocks/Scene3DBlock/useStreamBinding
 */

import { useEffect, useCallback } from 'react';
import { useAtom, useAtomValue } from '@effect-atom/atom-react';
import { Result } from '@effect-atom/atom-react';
import {
  useConnectionPortsSafe,
  useAtomStream,
  ViewArtifact,
} from '@/lib/connection-ports';
import type { Scene3DBlockAtoms, EntityData } from './atoms';
import { defaultPayloadToEntities } from './atoms';

// =============================================================================
// Types
// =============================================================================

export interface UseScene3DStreamBindingOptions {
  /** Block atoms instance */
  atoms: Scene3DBlockAtoms;

  /** Transform function for artifact payload → entities */
  payloadToEntities?: (payload: unknown) => EntityData[];

  /** Called when stream connects */
  onConnect?: () => void;

  /** Called when stream disconnects or errors */
  onError?: (error: Error) => void;

  /** Called when entities are updated from stream */
  onEntitiesUpdate?: (entities: EntityData[]) => void;
}

export interface UseScene3DStreamBindingReturn {
  /** Whether stream is connected */
  isConnected: boolean;

  /** Whether stream is loading */
  isLoading: boolean;

  /** Stream error message */
  error: string | null;

  /** Manually subscribe to stream */
  subscribe: () => void;

  /** Manually unsubscribe from stream */
  unsubscribe: () => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for binding Scene3D entities to ConnectionPorts streams.
 *
 * When a stream binding is configured, this hook:
 * 1. Subscribes to the configured stream on mount
 * 2. Transforms incoming ViewArtifact payloads to EntityData[]
 * 3. Updates the entitiesAtom with streamed entities
 * 4. Cleans up subscription on unmount
 *
 * @example
 * ```tsx
 * function Scene3DBlockView({ atoms }: Props) {
 *   const stream = useScene3DStreamBinding({
 *     atoms,
 *     onEntitiesUpdate: (entities) => console.log('Updated:', entities.length),
 *   });
 *
 *   if (stream.isLoading) return <Spinner />;
 *   if (stream.error) return <Error message={stream.error} />;
 *
 *   return <Scene entities={useAtomValue(atoms.entitiesAtom)} />;
 * }
 * ```
 */
export function useScene3DStreamBinding(
  options: UseScene3DStreamBindingOptions
): UseScene3DStreamBindingReturn {
  const {
    atoms,
    payloadToEntities = atoms.streamConfig?.payloadToEntities ?? defaultPayloadToEntities,
    onConnect,
    onError,
    onEntitiesUpdate,
  } = options;

  // Get connection ports context (safe version returns null if no provider)
  const connectionPorts = useConnectionPortsSafe();

  // Read stream binding configuration
  const streamBinding = useAtomValue(atoms.streamBindingAtom);
  const [, setEntities] = useAtom(atoms.entitiesAtom);
  const [, setIsLoading] = useAtom(atoms.isLoadingAtom);
  const [, setError] = useAtom(atoms.errorAtom);

  // Stream atoms (created when binding exists)
  const streamAtoms = connectionPorts && streamBinding
    ? connectionPorts.createStream({
        streamId: streamBinding.streamId,
        schema: ViewArtifact,
        replay: streamBinding.replay,
        fromOffset: streamBinding.fromOffset,
      })
    : null;

  // Use stream hook if atoms exist
  const streamResult = streamAtoms
    ? useAtomStream(streamAtoms.dataAtom)
    : { isInitial: true, isWaiting: false, isSuccess: false, isFailure: false, value: undefined, cause: undefined };

  // Process stream updates
  useEffect(() => {
    if (!streamResult.isSuccess || !streamResult.value) return;

    // Transform artifact payload to entities
    const artifact = streamResult.value as ViewArtifact;
    const entities = payloadToEntities(artifact.payload);

    // Update entities atom
    setEntities(entities);
    setIsLoading(false);
    setError(null);

    // Notify callback
    onEntitiesUpdate?.(entities);
  }, [streamResult.value, payloadToEntities, setEntities, setIsLoading, setError, onEntitiesUpdate]);

  // Handle stream connection
  useEffect(() => {
    if (streamResult.isSuccess && onConnect) {
      onConnect();
    }
  }, [streamResult.isSuccess, onConnect]);

  // Handle stream errors
  useEffect(() => {
    if (streamResult.isFailure && streamResult.cause) {
      const errorMessage = 'Stream connection failed';
      setError(errorMessage);
      setIsLoading(false);
      onError?.(new Error(errorMessage));
    }
  }, [streamResult.isFailure, streamResult.cause, setError, setIsLoading, onError]);

  // Subscribe/unsubscribe handlers
  const subscribe = useCallback(() => {
    if (streamAtoms) {
      streamAtoms.subscribe();
      setIsLoading(true);
    }
  }, [streamAtoms, setIsLoading]);

  const unsubscribe = useCallback(() => {
    if (streamAtoms) {
      streamAtoms.unsubscribe();
    }
  }, [streamAtoms]);

  // Auto-subscribe on mount if configured
  useEffect(() => {
    if (streamBinding?.autoSubscribe !== false && streamAtoms) {
      subscribe();
      return () => unsubscribe();
    }
  }, [streamBinding?.autoSubscribe, streamAtoms, subscribe, unsubscribe]);

  return {
    isConnected: streamResult.isSuccess,
    isLoading: streamResult.isInitial || streamResult.isWaiting,
    error: streamResult.isFailure ? 'Stream error' : null,
    subscribe,
    unsubscribe,
  };
}
