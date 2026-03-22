/**
 * Connection Ports Atoms
 *
 * Atom.runtime for connection ports services and reactive state atoms.
 *
 * @module connection-ports/atoms
 */

import { Atom } from '@effect-atom/atom-react';
import { Effect, Layer, Schema } from 'effect';
import {
  NatsPort,
  NatsPortLive,
  DurableStreamsPort,
  DurableStreamsPortLive,
  ConnectionBus,
  ConnectionBusLive,
} from '../services';
import {
  ConnectionPortsStatus,
  StreamStatus,
  PortStatus,
} from '../schemas/status';
import type { ViewArtifact } from '../schemas/artifacts';

// =============================================================================
// Runtime Layer
// =============================================================================

/**
 * Combined layer for all connection ports services.
 */
export const connectionPortsLayer = Layer.mergeAll(
  NatsPortLive,
  DurableStreamsPortLive
).pipe(Layer.provideMerge(ConnectionBusLive));

// =============================================================================
// Runtime Atom
// =============================================================================

/**
 * Connection ports runtime atom.
 * Provides access to all connection ports services.
 */
export const connectionBusRuntimeAtom = Atom.runtime(connectionPortsLayer);

// =============================================================================
// Status Atoms
// =============================================================================

/**
 * Overall connection status.
 */
export const connectionStatusAtom = Atom.make<ConnectionPortsStatus>(
  ConnectionPortsStatus.Initial
);

/**
 * Is fully connected (all ports connected).
 */
export const isConnectedAtom = Atom.make((get) =>
  get(connectionStatusAtom).isFullyConnected()
);

/**
 * NATS port status.
 */
export const natsStatusAtom = Atom.make((get) =>
  get(connectionStatusAtom).nats
);

/**
 * Durable Streams port status.
 */
export const durableStreamsStatusAtom = Atom.make((get) =>
  get(connectionStatusAtom).durableStreams
);

/**
 * Active stream count.
 */
export const activeStreamCountAtom = Atom.make((get) =>
  get(connectionStatusAtom).activeStreamCount()
);

// =============================================================================
// Stream Atoms Factory
// =============================================================================

/**
 * Configuration for stream atoms.
 */
export interface StreamAtomsConfig<A> {
  /** Stream identifier */
  readonly streamId: string;

  /** Schema for decoding stream data */
  readonly schema: Schema.Schema<A>;

  /** Enable replay from durable streams */
  readonly replay?: boolean;

  /** Starting offset for replay */
  readonly fromOffset?: string;
}

/**
 * Create atoms for a specific stream subscription.
 */
export function createStreamAtoms<A>(config: StreamAtomsConfig<A>) {
  const { streamId, schema, replay = false, fromOffset = 'earliest' } = config;

  /** Stream data accumulator */
  const dataAtom = Atom.make<readonly A[]>([]);

  /** Stream subscription status */
  const statusAtom = Atom.make<StreamStatus>(StreamStatus.empty(streamId));

  /** Current offset (for durable streams) */
  const offsetAtom = Atom.make<string | null>(null);

  /** Last error */
  const errorAtom = Atom.make<Error | null>(null);

  /** Is stream active */
  const isActiveAtom = Atom.make((get) => get(statusAtom).isActive());

  /** Message count */
  const messageCountAtom = Atom.make((get) => get(statusAtom).messagesReceived);

  /**
   * Subscribe operation.
   * Starts the stream subscription and updates atoms.
   */
  const subscribe = connectionBusRuntimeAtom.fn<void>()(() =>
    Effect.gen(function* () {
      const bus = yield* ConnectionBus;

      // Update status to subscribing
      Atom.set(statusAtom, (s) => s.withState('subscribing'));
      Atom.set(errorAtom, null);
      Atom.set(dataAtom, []);

      const stream = bus.subscribe(streamId, schema, { replay, fromOffset });

      // Process stream and update atoms
      yield* stream.pipe(
        Effect.forEach(
          (data) =>
            Effect.sync(() => {
              Atom.set(dataAtom, (prev) => [...prev, data]);
              Atom.set(statusAtom, (s) => s.withMessage(0));
            }),
          { concurrency: 1 }
        ),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            Atom.set(errorAtom, error instanceof Error ? error : new Error(String(error)));
            Atom.set(statusAtom, (s) => s.withError(String(error)));
          })
        ),
        Effect.ensuring(
          Effect.sync(() => {
            Atom.set(statusAtom, (s) => s.withState('closed'));
          })
        )
      );
    }).pipe(Effect.withSpan('createStreamAtoms.subscribe', { attributes: { streamId } }))
  );

  /**
   * Clear accumulated data.
   */
  const clear = () => {
    Atom.set(dataAtom, []);
    Atom.set(errorAtom, null);
  };

  return {
    streamId,
    // State atoms
    dataAtom,
    statusAtom,
    offsetAtom,
    errorAtom,
    // Derived atoms
    isActiveAtom,
    messageCountAtom,
    // Operations
    subscribe,
    clear,
  };
}

export type StreamAtoms<A> = ReturnType<typeof createStreamAtoms<A>>;

// =============================================================================
// View Artifact Atoms (Atom.family pattern)
// =============================================================================

/**
 * Registry of view artifact atoms.
 * Uses Atom.family-like pattern for per-view isolation.
 */
const viewArtifactRegistry = new Map<string, ReturnType<typeof createViewArtifactAtoms>>();

/**
 * Create atoms for a specific view artifact.
 */
function createViewArtifactAtoms(viewId: string) {
  /** View artifact data */
  const artifactAtom = Atom.make<ViewArtifact | null>(null);

  /** Loading state */
  const isLoadingAtom = Atom.make(false);

  /** Error state */
  const errorAtom = Atom.make<Error | null>(null);

  /** Version number */
  const versionAtom = Atom.make((get) => get(artifactAtom)?.version ?? 0);

  /** Is ready */
  const isReadyAtom = Atom.make((get) => get(artifactAtom)?.isReady() ?? false);

  /** Is stale */
  const isStaleAtom = Atom.make((get) => get(artifactAtom)?.isStale() ?? false);

  return {
    viewId,
    artifactAtom,
    isLoadingAtom,
    errorAtom,
    versionAtom,
    isReadyAtom,
    isStaleAtom,
  };
}

/**
 * Get or create view artifact atoms.
 */
export function getViewArtifactAtoms(viewId: string) {
  let atoms = viewArtifactRegistry.get(viewId);
  if (!atoms) {
    atoms = createViewArtifactAtoms(viewId);
    viewArtifactRegistry.set(viewId, atoms);
  }
  return atoms;
}

/**
 * Dispose view artifact atoms.
 */
export function disposeViewArtifactAtoms(viewId: string) {
  viewArtifactRegistry.delete(viewId);
}

export type ViewArtifactAtoms = ReturnType<typeof getViewArtifactAtoms>;

// =============================================================================
// View Layers Atoms (Derived deck.gl layers from artifacts)
// =============================================================================

import type { Layer as DeckLayer } from '@deck.gl/core';
import {
  buildLayersFromSpecSync,
  type LayerBuildResult,
  type LayerBuildError,
  type MapRenderOptions,
} from '../layers';

/**
 * Registry of view layers atoms.
 * Derives deck.gl layers from ViewArtifact renderSpec.
 */
const viewLayersRegistry = new Map<string, ReturnType<typeof createViewLayersAtoms>>();

/**
 * Create derived layer atoms for a specific view.
 */
function createViewLayersAtoms(viewId: string) {
  const artifactAtoms = getViewArtifactAtoms(viewId);

  /** Derived layers from artifact.renderSpec */
  const layersAtom = Atom.make<readonly DeckLayer[]>((get) => {
    const artifact = get(artifactAtoms.artifactAtom);
    if (!artifact || !artifact.isReady()) return [];

    // Extract render options from renderSpec
    const renderOptions = artifact.renderSpec.options as MapRenderOptions | undefined;
    if (!renderOptions?.layers) return [];

    // Extract data from payload
    const data = Array.isArray(artifact.payload)
      ? artifact.payload
      : artifact.payload && typeof artifact.payload === 'object' && 'data' in artifact.payload
        ? (artifact.payload as { data: unknown[] }).data
        : [];

    // Build layers
    const result = buildLayersFromSpecSync(renderOptions, { data });
    return result.layers;
  });

  /** Layer build errors */
  const layerErrorsAtom = Atom.make<readonly LayerBuildError[]>((get) => {
    const artifact = get(artifactAtoms.artifactAtom);
    if (!artifact || !artifact.isReady()) return [];

    const renderOptions = artifact.renderSpec.options as MapRenderOptions | undefined;
    if (!renderOptions?.layers) return [];

    const data = Array.isArray(artifact.payload)
      ? artifact.payload
      : artifact.payload && typeof artifact.payload === 'object' && 'data' in artifact.payload
        ? (artifact.payload as { data: unknown[] }).data
        : [];

    const result = buildLayersFromSpecSync(renderOptions, { data });
    return result.errors;
  });

  /** Layer count */
  const layerCountAtom = Atom.make((get) => get(layersAtom).length);

  /** Has layer errors */
  const hasLayerErrorsAtom = Atom.make((get) => get(layerErrorsAtom).length > 0);

  return {
    viewId,
    layersAtom,
    layerErrorsAtom,
    layerCountAtom,
    hasLayerErrorsAtom,
    // Also expose the underlying artifact atoms
    ...artifactAtoms,
  };
}

/**
 * Get or create view layers atoms.
 * Returns derived atoms that produce deck.gl layers from ViewArtifact.
 */
export function getViewLayersAtoms(viewId: string) {
  let atoms = viewLayersRegistry.get(viewId);
  if (!atoms) {
    atoms = createViewLayersAtoms(viewId);
    viewLayersRegistry.set(viewId, atoms);
  }
  return atoms;
}

/**
 * Dispose view layers atoms.
 */
export function disposeViewLayersAtoms(viewId: string) {
  viewLayersRegistry.delete(viewId);
  disposeViewArtifactAtoms(viewId);
}

export type ViewLayersAtoms = ReturnType<typeof getViewLayersAtoms>;

// =============================================================================
// Operations
// =============================================================================

/**
 * Connection bus operations.
 */
export const connectionOps = {
  /**
   * Connect to all ports.
   */
  connect: connectionBusRuntimeAtom.fn<void>()(() =>
    Effect.gen(function* () {
      const bus = yield* ConnectionBus;
      yield* bus.connect;

      // Update status atom
      const status = yield* bus.status;
      Atom.set(connectionStatusAtom, status);
    }).pipe(Effect.withSpan('connectionOps.connect'))
  ),

  /**
   * Disconnect from all ports.
   */
  disconnect: connectionBusRuntimeAtom.fn<void>()(() =>
    Effect.gen(function* () {
      const bus = yield* ConnectionBus;
      yield* bus.disconnect;

      Atom.set(connectionStatusAtom, ConnectionPortsStatus.Initial);
    }).pipe(Effect.withSpan('connectionOps.disconnect'))
  ),

  /**
   * Refresh status from ports.
   */
  refreshStatus: connectionBusRuntimeAtom.fn<void>()(() =>
    Effect.gen(function* () {
      const bus = yield* ConnectionBus;
      const status = yield* bus.status;
      Atom.set(connectionStatusAtom, status);
    }).pipe(Effect.withSpan('connectionOps.refreshStatus'))
  ),
};
