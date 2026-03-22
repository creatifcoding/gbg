/**
 * MapBlock Stream Binding Hook
 *
 * Connects MapBlock markers to ConnectionPorts for streaming
 * marker updates from AVA via NATS/Durable Streams.
 *
 * @module editor/v3/extensions/blocks/MapBlock/useStreamBinding
 */

import { useEffect, useCallback } from 'react';
import { useAtom, useAtomValue } from '@effect-atom/atom-react';
import { Result } from '@effect-atom/atom-react';
import {
  useConnectionPortsSafe,
  useAtomStream,
  ViewArtifact,
} from '@/lib/connection-ports';
import type { MapBlockAtoms, MarkerData } from './atoms';
import { defaultPayloadToMarkers } from './atoms';

// =============================================================================
// Types
// =============================================================================

export interface UseMapStreamBindingOptions {
  /** Block atoms instance */
  atoms: MapBlockAtoms;

  /** Transform function for artifact payload → markers */
  payloadToMarkers?: (payload: unknown) => MarkerData[];

  /** Called when stream connects */
  onConnect?: () => void;

  /** Called when stream disconnects or errors */
  onError?: (error: Error) => void;

  /** Called when markers are updated from stream */
  onMarkersUpdate?: (markers: MarkerData[]) => void;
}

export interface UseMapStreamBindingReturn {
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
 * Hook for binding MapBlock markers to ConnectionPorts streams.
 *
 * When a stream binding is configured, this hook:
 * 1. Subscribes to the configured stream on mount
 * 2. Transforms incoming ViewArtifact payloads to MarkerData[]
 * 3. Updates the markersAtom with streamed markers
 * 4. Cleans up subscription on unmount
 *
 * @example
 * ```tsx
 * function MapBlockView({ atoms }: Props) {
 *   const stream = useMapStreamBinding({
 *     atoms,
 *     onMarkersUpdate: (markers) => console.log('Updated:', markers.length),
 *   });
 *
 *   if (stream.isLoading) return <Spinner />;
 *   if (stream.error) return <Error message={stream.error} />;
 *
 *   return <Map markers={useAtomValue(atoms.markersAtom)} />;
 * }
 * ```
 */
export function useMapStreamBinding(
  options: UseMapStreamBindingOptions
): UseMapStreamBindingReturn {
  const {
    atoms,
    payloadToMarkers = atoms.streamConfig?.payloadToMarkers ?? defaultPayloadToMarkers,
    onConnect,
    onError,
    onMarkersUpdate,
  } = options;

  // Get connection ports context (safe version returns null if no provider)
  const connectionPorts = useConnectionPortsSafe();

  // Read stream binding configuration
  const streamBinding = useAtomValue(atoms.streamBindingAtom);
  const [, setMarkers] = useAtom(atoms.markersAtom);
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

    // Transform artifact payload to markers
    const artifact = streamResult.value as ViewArtifact;
    const markers = payloadToMarkers(artifact.payload);

    // Update markers atom
    setMarkers(markers);
    setIsLoading(false);
    setError(null);

    // Notify callback
    onMarkersUpdate?.(markers);
  }, [streamResult.value, payloadToMarkers, setMarkers, setIsLoading, setError, onMarkersUpdate]);

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
