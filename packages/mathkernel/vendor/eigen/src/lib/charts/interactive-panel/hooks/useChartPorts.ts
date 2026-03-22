/**
 * useChartPorts Hook
 *
 * Dataplane integration for InteractiveChartPanel.
 * Provides access to chart ports, connections, and data flow.
 *
 * @module charts/interactive-panel/hooks/useChartPorts
 */

import { useMemo } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import {
  linksAtom,
  versionAtom,
} from '@/lib/dataplane/atoms';
import { useBlockPorts } from '@/lib/dataplane/hooks/usePortData';
import type { LinkPort, Link, PortId } from '@/lib/dataplane/schemas/link';

// =============================================================================
// Types
// =============================================================================

export interface ChartPortsState {
  /** All ports registered for this chart */
  readonly ports: ReadonlyArray<LinkPort>;
  /** Input ports (receive data) */
  readonly inputPorts: ReadonlyArray<LinkPort>;
  /** Output ports (send data) */
  readonly outputPorts: ReadonlyArray<LinkPort>;
  /** Links connected to any of this chart's ports */
  readonly links: ReadonlyArray<Link>;
  /** Whether the chart has any port connections */
  readonly hasConnections: boolean;
  /** Whether any input port has data */
  readonly hasInputData: boolean;
  /** Dataplane version (for change detection) */
  readonly version: number;
  /** Whether ports should be shown in UI */
  readonly shouldShowPorts: boolean;
}

export interface UseChartPortsOptions {
  /** Show ports even when no connections exist */
  showPortsAlways?: boolean;
  /** Filter ports by data type */
  dataTypeFilter?: string;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access dataplane ports for a chart.
 *
 * Integrates with existing dataplane atoms to provide:
 * - Port discovery for the chart's block
 * - Connection status
 * - Data flow information
 *
 * @param chartId - The chart ID (used as block ID in dataplane)
 * @param options - Configuration options
 * @returns Chart ports state
 *
 * @example
 * ```tsx
 * function ChartWithPorts({ chartId }: { chartId: string }) {
 *   const {
 *     inputPorts,
 *     outputPorts,
 *     hasConnections,
 *     shouldShowPorts,
 *   } = useChartPorts(chartId);
 *
 *   return (
 *     <div>
 *       {shouldShowPorts && <PortIndicators ports={inputPorts} />}
 *       <ChartContent />
 *     </div>
 *   );
 * }
 * ```
 */
export function useChartPorts(
  chartId: string,
  options: UseChartPortsOptions = {}
): ChartPortsState {
  const { showPortsAlways = false, dataTypeFilter } = options;

  // Get all ports for this chart's block
  const ports = useBlockPorts(chartId);

  // Get all links to check connections
  const allLinks = useAtomValue(linksAtom);

  // Track dataplane version
  const version = useAtomValue(versionAtom);

  // Derive port categories
  const { inputPorts, outputPorts } = useMemo(() => {
    let filtered = ports;

    // Apply data type filter if specified
    if (dataTypeFilter) {
      filtered = ports.filter((p) => p.dataType === dataTypeFilter);
    }

    const inputs = filtered.filter(
      (p) => p.direction === 'in' || p.direction === 'inout'
    );
    const outputs = filtered.filter(
      (p) => p.direction === 'out' || p.direction === 'inout'
    );

    return { inputPorts: inputs, outputPorts: outputs };
  }, [ports, dataTypeFilter]);

  // Get port IDs for link filtering
  const portIds = useMemo(
    () => new Set(ports.map((p) => p.id)),
    [ports]
  );

  // Filter links to those connected to this chart
  const links = useMemo(
    () =>
      allLinks.filter(
        (link) =>
          portIds.has(link.sourcePort) || portIds.has(link.targetPort)
      ),
    [allLinks, portIds]
  );

  // Derived state
  const hasConnections = links.length > 0;

  // Check if any input port has data (connected to a source)
  const hasInputData = useMemo(
    () =>
      inputPorts.some((port) =>
        links.some((link) => link.targetPort === port.id)
      ),
    [inputPorts, links]
  );

  // Determine if ports should be shown
  const shouldShowPorts = showPortsAlways || hasConnections || ports.length > 0;

  return {
    ports,
    inputPorts,
    outputPorts,
    links,
    hasConnections,
    hasInputData,
    version,
    shouldShowPorts,
  };
}

// =============================================================================
// Convenience Hooks
// =============================================================================

/**
 * Hook to check if a chart has any connections.
 *
 * @param chartId - The chart ID
 * @returns True if the chart has any port connections
 */
export function useChartHasConnections(chartId: string): boolean {
  const { hasConnections } = useChartPorts(chartId);
  return hasConnections;
}

/**
 * Hook to get the count of connections for a chart.
 *
 * @param chartId - The chart ID
 * @returns Number of links connected to this chart
 */
export function useChartConnectionCount(chartId: string): number {
  const { links } = useChartPorts(chartId);
  return links.length;
}

/**
 * Hook to check if a specific port is connected.
 *
 * @param chartId - The chart ID
 * @param portId - The port ID to check
 * @returns True if the port has any connections
 */
export function usePortIsConnected(chartId: string, portId: PortId): boolean {
  const { links } = useChartPorts(chartId);
  return links.some(
    (link) => link.sourcePort === portId || link.targetPort === portId
  );
}

/**
 * Hook to get input ports for a chart.
 *
 * @param chartId - The chart ID
 * @returns Array of input ports
 */
export function useChartInputPorts(chartId: string): ReadonlyArray<LinkPort> {
  const { inputPorts } = useChartPorts(chartId);
  return inputPorts;
}

/**
 * Hook to get output ports for a chart.
 *
 * @param chartId - The chart ID
 * @returns Array of output ports
 */
export function useChartOutputPorts(chartId: string): ReadonlyArray<LinkPort> {
  const { outputPorts } = useChartPorts(chartId);
  return outputPorts;
}
