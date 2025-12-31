/**
 * @fileoverview Simple hooks for block data transfer
 *
 * BEDROCK API for blocks:
 * - useOutputPort: Get a push function to send data
 * - useInputPort: Get a stream to receive data
 *
 * Usage:
 * ```tsx
 * // Producer block
 * const { push } = useOutputPort<TableData>(blockId, 'data-out');
 * push(myTableData);
 *
 * // Consumer block
 * const { data, isConnected } = useInputPort<TableData>(blockId, 'data-in');
 * // data updates reactively when producer pushes
 * ```
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Effect, Stream, Fiber, Exit } from 'effect';
import { Atom, useAtomValue } from '@effect-atom/atom-react';
import type { PortId, BlockId } from '../schemas/link';
import { DataTransferService } from '../services/DataTransferService';
import { dataplaneRuntimeAtom, linksForPortAtom } from '../atoms';

// =============================================================================
// Types
// =============================================================================

export interface UseOutputPortResult<T> {
  /** Push data to all connected input ports */
  readonly push: (data: T) => void;
  /** Whether this port has any outgoing links */
  readonly isConnected: boolean;
  /** Port ID (for debugging/display) */
  readonly portId: PortId;
}

export interface UseInputPortResult<T> {
  /** Latest data received (null if nothing received yet) */
  readonly data: T | null;
  /** Whether this port has any incoming links */
  readonly isConnected: boolean;
  /** Port ID (for debugging/display) */
  readonly portId: PortId;
  /** Clear the current data */
  readonly clear: () => void;
}

// =============================================================================
// Atoms for port data state
// =============================================================================

/** Per-port data atom family - stores latest received data */
const portDataAtomFamily = Atom.family((portId: string) =>
  Atom.make<unknown>(null)
);

// =============================================================================
// useOutputPort Hook
// =============================================================================

/**
 * Hook for output ports - provides a push function to send data.
 *
 * @param blockId - The block this port belongs to
 * @param portLabel - Label to identify this port within the block (e.g., 'data-out')
 * @returns Push function and connection status
 *
 * @example
 * ```tsx
 * function DataGridBlock({ blockId }) {
 *   const { push, isConnected } = useOutputPort<TableData>(blockId, 'data-out');
 *
 *   const handleExport = () => {
 *     push(gridData); // Sends to all connected blocks
 *   };
 *
 *   return (
 *     <button onClick={handleExport} disabled={!isConnected}>
 *       Export Data
 *     </button>
 *   );
 * }
 * ```
 */
export function useOutputPort<T>(
  blockId: BlockId,
  portLabel: string
): UseOutputPortResult<T> {
  // Construct port ID from block + label
  const portId = `${blockId}:${portLabel}` as PortId;

  // Check if connected (has outgoing links)
  const links = useAtomValue(linksForPortAtom(portId));
  const isConnected = links.length > 0;

  // Push function - runs Effect to publish data
  const push = useCallback(
    (data: T) => {
      const program = Effect.gen(function* () {
        const service = yield* DataTransferService;
        yield* service.push(portId, data);
      });

      // Run with the dataplane runtime
      Effect.runFork(
        program.pipe(Effect.provide(DataTransferService.Default))
      );
    },
    [portId]
  );

  return {
    push,
    isConnected,
    portId,
  };
}

// =============================================================================
// useInputPort Hook
// =============================================================================

/**
 * Hook for input ports - provides reactive data from connected sources.
 *
 * @param blockId - The block this port belongs to
 * @param portLabel - Label to identify this port within the block (e.g., 'data-in')
 * @returns Latest data, connection status, and clear function
 *
 * @example
 * ```tsx
 * function MapBlock({ blockId }) {
 *   const { data, isConnected } = useInputPort<GeoData>(blockId, 'geo-in');
 *
 *   useEffect(() => {
 *     if (data) {
 *       map.setData(data);
 *     }
 *   }, [data]);
 *
 *   return (
 *     <div>
 *       {!isConnected && <span>No data source connected</span>}
 *       <MapCanvas />
 *     </div>
 *   );
 * }
 * ```
 */
export function useInputPort<T>(
  blockId: BlockId,
  portLabel: string
): UseInputPortResult<T> {
  // Construct port ID from block + label
  const portId = `${blockId}:${portLabel}` as PortId;

  // Local state for received data
  const [data, setData] = useState<T | null>(null);
  const fiberRef = useRef<Fiber.RuntimeFiber<void, never> | null>(null);

  // Check if connected (has incoming links)
  const links = useAtomValue(linksForPortAtom(portId));
  const isConnected = links.length > 0;

  // Subscribe to input stream
  useEffect(() => {
    const program = Effect.gen(function* () {
      const service = yield* DataTransferService;
      const stream = yield* service.getInputStream<T>(portId);

      // Process incoming data
      yield* stream.pipe(
        Stream.tap((incoming) =>
          Effect.sync(() => {
            setData(incoming);
          })
        ),
        Stream.runDrain
      );
    });

    // Fork the stream consumer
    const fiber = Effect.runFork(
      program.pipe(Effect.provide(DataTransferService.Default))
    );
    fiberRef.current = fiber;

    // Cleanup: interrupt fiber on unmount
    return () => {
      if (fiberRef.current) {
        Effect.runFork(Fiber.interrupt(fiberRef.current));
        fiberRef.current = null;
      }
    };
  }, [portId]);

  // Clear function
  const clear = useCallback(() => {
    setData(null);
  }, []);

  return {
    data,
    isConnected,
    portId,
    clear,
  };
}

// =============================================================================
// usePortChannel Hook (Internal - for port registration)
// =============================================================================

/**
 * Internal hook to register a port's data channel on mount.
 * Called by EmbeddedBlockWrapper or block components.
 *
 * @param config - Port channel configuration
 */
export function usePortChannel(config: {
  portId: PortId;
  blockId: BlockId;
  direction: 'in' | 'out' | 'inout';
}) {
  const { portId, blockId, direction } = config;

  useEffect(() => {
    // Create channel on mount
    const createProgram = Effect.gen(function* () {
      const service = yield* DataTransferService;
      yield* service.createChannel({ portId, blockId, direction });
    });

    Effect.runFork(
      createProgram.pipe(Effect.provide(DataTransferService.Default))
    );

    // Destroy channel on unmount
    return () => {
      const destroyProgram = Effect.gen(function* () {
        const service = yield* DataTransferService;
        yield* service.destroyChannel(portId);
      });

      Effect.runFork(
        destroyProgram.pipe(Effect.provide(DataTransferService.Default))
      );
    };
  }, [portId, blockId, direction]);
}
