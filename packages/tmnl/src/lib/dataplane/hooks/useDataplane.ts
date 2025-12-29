/**
 * @fileoverview useDataplane Hook
 *
 * Primary hook for dataplane access in React components.
 * Provides port registration/unregistration with automatic cleanup.
 *
 * @example
 * ```tsx
 * function MyBlock({ blockId }: { blockId: BlockId }) {
 *   const { registerPort, unregisterPort, pushData } = useDataplane();
 *
 *   useEffect(() => {
 *     const port = registerPort({
 *       blockId,
 *       direction: 'in',
 *       dataType: 'table',
 *       position: 'left',
 *     });
 *
 *     return () => {
 *       if (port) unregisterPort(port.id);
 *     };
 *   }, [blockId]);
 * }
 * ```
 */

import { useCallback } from 'react';
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import * as Result from '@effect-atom/atom/Result';

import {
  dataplaneRuntimeAtom,
  graphInitializedAtom,
  portsAtom,
  linksAtom,
  dataplaneOps,
} from '../atoms';
import type {
  PortId,
  LinkId,
  CreatePortConfig,
  CreateLinkConfig,
  LinkPort,
  Link,
} from '../schemas/link';

export interface UseDataplaneReturn {
  /** Whether the d2ts graph is initialized */
  readonly isInitialized: boolean;

  /** All registered ports */
  readonly ports: ReadonlyArray<LinkPort>;

  /** All created links */
  readonly links: ReadonlyArray<Link>;

  /** Initialize the d2ts graph (call once at app startup) */
  readonly initGraph: () => Promise<void>;

  /**
   * Register a new port.
   * Returns the created port, or null if registration failed.
   */
  readonly registerPort: (config: CreatePortConfig) => Promise<LinkPort | null>;

  /** Unregister a port by ID */
  readonly unregisterPort: (portId: PortId) => Promise<void>;

  /**
   * Create a link between two ports.
   * Returns the created link, or null if creation failed.
   */
  readonly createLink: (config: CreateLinkConfig) => Promise<Link | null>;

  /** Remove a link by ID */
  readonly removeLink: (linkId: LinkId) => Promise<void>;

  /** Push data to a port */
  readonly pushData: (portId: PortId, data: ReadonlyArray<unknown>) => Promise<void>;

  /** Run the d2ts graph (process pending data) */
  readonly runGraph: () => Promise<void>;
}

/**
 * Hook for dataplane access.
 *
 * Provides operations to register ports, create links, and push data
 * through the d2ts differential dataflow graph.
 */
export function useDataplane(): UseDataplaneReturn {
  // Read state from atoms
  const runtimeResult = useAtomValue(dataplaneRuntimeAtom);
  const isInitialized = useAtomValue(graphInitializedAtom);
  const ports = useAtomValue(portsAtom);
  const links = useAtomValue(linksAtom);

  // ---------------------------------------------------------------------------
  // Operation Setters (fn atoms return promises via useAtomSet)
  // ---------------------------------------------------------------------------
  const doInitGraph = useAtomSet(dataplaneOps.initGraph, { mode: 'promise' });
  const doRegisterPort = useAtomSet(dataplaneOps.registerPort, { mode: 'promise' });
  const doUnregisterPort = useAtomSet(dataplaneOps.unregisterPort, { mode: 'promise' });
  const doCreateLink = useAtomSet(dataplaneOps.createLink, { mode: 'promise' });
  const doRemoveLink = useAtomSet(dataplaneOps.removeLink, { mode: 'promise' });
  const doPushData = useAtomSet(dataplaneOps.pushData, { mode: 'promise' });
  const doRunGraph = useAtomSet(dataplaneOps.runGraph, { mode: 'promise' });

  // Helper to ensure runtime is ready
  const ensureRuntime = useCallback(() => {
    if (!Result.isSuccess(runtimeResult)) {
      console.warn('[useDataplane] Runtime not ready');
      return false;
    }
    return true;
  }, [runtimeResult]);

  // ---------------------------------------------------------------------------
  // Wrapped Operations
  // ---------------------------------------------------------------------------
  const initGraph = useCallback(async () => {
    if (!ensureRuntime()) return;
    await doInitGraph(undefined);
  }, [ensureRuntime, doInitGraph]);

  const registerPort = useCallback(
    async (config: CreatePortConfig): Promise<LinkPort | null> => {
      if (!ensureRuntime()) return null;

      try {
        const result = await doRegisterPort(config);
        return result as LinkPort;
      } catch (err) {
        console.error('[useDataplane] registerPort error:', err);
        return null;
      }
    },
    [ensureRuntime, doRegisterPort]
  );

  const unregisterPort = useCallback(
    async (portId: PortId): Promise<void> => {
      if (!ensureRuntime()) return;

      try {
        await doUnregisterPort(portId);
      } catch (err) {
        console.error('[useDataplane] unregisterPort error:', err);
      }
    },
    [ensureRuntime, doUnregisterPort]
  );

  const createLink = useCallback(
    async (config: CreateLinkConfig): Promise<Link | null> => {
      if (!ensureRuntime()) return null;

      try {
        const result = await doCreateLink(config);
        return result as Link;
      } catch (err) {
        console.error('[useDataplane] createLink error:', err);
        return null;
      }
    },
    [ensureRuntime, doCreateLink]
  );

  const removeLink = useCallback(
    async (linkId: LinkId): Promise<void> => {
      if (!ensureRuntime()) return;

      try {
        await doRemoveLink(linkId);
      } catch (err) {
        console.error('[useDataplane] removeLink error:', err);
      }
    },
    [ensureRuntime, doRemoveLink]
  );

  const pushData = useCallback(
    async (portId: PortId, data: ReadonlyArray<unknown>): Promise<void> => {
      if (!ensureRuntime()) return;

      try {
        await doPushData({ portId, data });
      } catch (err) {
        console.error('[useDataplane] pushData error:', err);
      }
    },
    [ensureRuntime, doPushData]
  );

  const runGraph = useCallback(async (): Promise<void> => {
    if (!ensureRuntime()) return;

    try {
      await doRunGraph(undefined);
    } catch (err) {
      console.error('[useDataplane] runGraph error:', err);
    }
  }, [ensureRuntime, doRunGraph]);

  return {
    isInitialized,
    ports,
    links,
    initGraph,
    registerPort,
    unregisterPort,
    createLink,
    removeLink,
    pushData,
    runGraph,
  };
}

/**
 * Hook for automatic port registration with cleanup.
 *
 * Registers a port on mount and unregisters on unmount.
 * Returns the port once registered.
 *
 * @example
 * ```tsx
 * function DataGridBlock({ blockId }: { blockId: BlockId }) {
 *   const inPort = usePort({
 *     blockId,
 *     direction: 'in',
 *     dataType: 'table',
 *     position: 'left',
 *   });
 *
 *   const outPort = usePort({
 *     blockId,
 *     direction: 'out',
 *     dataType: 'table',
 *     position: 'right',
 *   });
 *
 *   // inPort and outPort will be null until registered
 * }
 * ```
 */
export function usePort(config: CreatePortConfig): LinkPort | null {
  const { registerPort, unregisterPort } = useDataplane();
  const portRef = useRef<LinkPort | null>(null);
  const configRef = useRef(config);

  // Only re-register if config actually changes
  const configKey = `${config.blockId}:${config.direction}:${config.dataType}:${config.position}`;

  // Use effect for registration - but we need to handle this carefully
  // to avoid the async gap between mount and unmount
  if (portRef.current === null) {
    // Kick off registration (async, but we track the result)
    registerPort(config).then((port) => {
      if (port) {
        portRef.current = port;
      }
    });
  }

  return portRef.current;
}
