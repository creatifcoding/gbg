/**
 * @fileoverview usePortData Hook
 *
 * Subscribe to data flowing through a specific port.
 * Updates reactively when new data arrives via the dataplane.
 *
 * @example
 * ```tsx
 * function DataConsumer({ portId }: { portId: PortId }) {
 *   const { data, version, isConnected } = usePortData(portId);
 *
 *   if (!isConnected) {
 *     return <div>Port not connected</div>;
 *   }
 *
 *   return <DataGrid rows={data} />;
 * }
 * ```
 */

import { useMemo } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';

import {
  portAtom,
  linksForPortAtom,
  versionAtom,
} from '../atoms';
import type { PortId, LinkPort, Link } from '../schemas/link';

export interface UsePortDataReturn<T = unknown> {
  /** The port instance, or null if not found */
  readonly port: LinkPort | null;

  /** Links connected to this port (as source or target) */
  readonly links: ReadonlyArray<Link>;

  /** Whether the port has any connections */
  readonly isConnected: boolean;

  /** Whether this port is an input (receives data) */
  readonly isInput: boolean;

  /** Whether this port is an output (sends data) */
  readonly isOutput: boolean;

  /** Current dataplane version (increments on data flow) */
  readonly version: number;

  /**
   * Data received at this port.
   * Note: In the current implementation, data flows through d2ts
   * and updates are tracked via version. The actual data buffer
   * would be managed by the DataplaneService.
   *
   * TODO: Wire up actual data buffer from d2ts graph outputs.
   */
  readonly data: ReadonlyArray<T>;
}

/**
 * Hook to subscribe to data at a specific port.
 *
 * Provides reactive access to:
 * - Port metadata (direction, data type, position)
 * - Connected links
 * - Connection status
 * - Dataplane version (for change detection)
 *
 * @param portId - The ID of the port to subscribe to
 * @returns Port data and metadata
 */
export function usePortData<T = unknown>(portId: PortId): UsePortDataReturn<T> {
  // Get port instance via family atom
  const port = useAtomValue(useMemo(() => portAtom(portId), [portId]));

  // Get links connected to this port
  const links = useAtomValue(useMemo(() => linksForPortAtom(portId), [portId]));

  // Track dataplane version for reactivity
  const version = useAtomValue(versionAtom);

  // Derived state
  const isConnected = links.length > 0;
  const isInput = port?.direction === 'in' || port?.direction === 'inout';
  const isOutput = port?.direction === 'out' || port?.direction === 'inout';

  // TODO: Wire up actual data from d2ts graph
  // For now, return empty array - data flow will be implemented
  // when we connect the d2ts output handlers
  const data: ReadonlyArray<T> = [];

  return {
    port,
    links,
    isConnected,
    isInput,
    isOutput,
    version,
    data,
  };
}

/**
 * Hook to check if a port has incoming connections.
 *
 * @param portId - The ID of the port to check
 * @returns True if the port has at least one incoming link
 */
export function useHasIncoming(portId: PortId): boolean {
  const links = useAtomValue(useMemo(() => linksForPortAtom(portId), [portId]));
  return links.some((link) => link.targetPort === portId);
}

/**
 * Hook to check if a port has outgoing connections.
 *
 * @param portId - The ID of the port to check
 * @returns True if the port has at least one outgoing link
 */
export function useHasOutgoing(portId: PortId): boolean {
  const links = useAtomValue(useMemo(() => linksForPortAtom(portId), [portId]));
  return links.some((link) => link.sourcePort === portId);
}

/**
 * Hook to get all ports for a specific block.
 *
 * @param blockId - The block ID to filter by
 * @returns Array of ports belonging to this block
 */
export function useBlockPorts(blockId: string): ReadonlyArray<LinkPort> {
  const allPorts = useAtomValue(
    useMemo(
      () => {
        // Import portsAtom here to avoid circular deps
        const { portsAtom } = require('../atoms');
        return portsAtom;
      },
      []
    )
  );

  return useMemo(
    () => allPorts.filter((port) => port.blockId === blockId),
    [allPorts, blockId]
  );
}
