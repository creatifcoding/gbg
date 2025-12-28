/**
 * Connection Ports
 *
 * Network abstraction layer for TMNL enabling reactive data streaming
 * from AVA through NATS and Durable Streams.
 *
 * @module connection-ports
 */

// =============================================================================
// Schemas
// =============================================================================

export {
  // Connection config
  StreamId,
  NatsSubject,
  DurableStreamUrl,
  NatsConfig,
  DurableStreamsConfig,
  ConnectionConfig,
} from './schemas/connection';

export {
  // Status types
  ConnectionState,
  StreamState,
  PortStatus,
  StreamStatus,
  ConnectionPortsStatus,
} from './schemas/status';

export {
  // Errors
  NatsConnectionError,
  NatsPublishError,
  NatsSubscribeError,
  DurableStreamsConnectionError,
  DurableStreamsReadError,
  DurableStreamsAppendError,
  StreamDecodeError,
  ConnectionBusNotInitializedError,
  type NatsError,
  type DurableStreamsError,
  type ConnectionPortsError,
} from './schemas/errors';

export {
  // Artifacts
  ViewId,
  RenderSpec,
  TraitSpec,
  PipelineSpec,
  ViewArtifact,
  ViewDelta,
  // Stream binding
  StreamBinding,
} from './schemas/artifacts';

// =============================================================================
// Services
// =============================================================================

export {
  // NatsPort
  NatsPort,
  NatsPortConfig,
  NatsPortMock,
  NatsPortLive,
  type NatsPortShape,
} from './services/NatsPort';

export {
  // DurableStreamsPort
  DurableStreamsPort,
  DurableStreamsPortConfig,
  DurableStreamsPortMock,
  DurableStreamsPortLive,
  type DurableStreamsPortShape,
  type StreamMetadata,
  type AppendResult,
} from './services/DurableStreamsPort';

export {
  // ConnectionBus
  ConnectionBus,
  ConnectionBusLive,
  type ConnectionBusShape,
  type SubscribeOptions,
} from './services/ConnectionBus';

// =============================================================================
// Atoms
// =============================================================================

export {
  // Runtime & layers
  connectionPortsLayer,
  connectionBusRuntimeAtom,
  // Status atoms
  connectionStatusAtom,
  isConnectedAtom,
  natsStatusAtom,
  durableStreamsStatusAtom,
  activeStreamCountAtom,
  // Stream atoms factory
  createStreamAtoms,
  type StreamAtoms,
  type StreamAtomsConfig,
  // View artifact atoms
  getViewArtifactAtoms,
  disposeViewArtifactAtoms,
  type ViewArtifactAtoms,
  // View layers atoms (derived deck.gl layers)
  getViewLayersAtoms,
  disposeViewLayersAtoms,
  type ViewLayersAtoms,
  // Operations
  connectionOps,
} from './atoms';

// =============================================================================
// Providers
// =============================================================================

export {
  // Provider
  ConnectionPortsProvider,
  useConnectionPorts,
  useConnectionPortsSafe,
  ConnectionPortsContext,
  type ConnectionPortsProviderProps,
  type ConnectionPortsContextValue,
  type CreateStreamOptions,
} from './providers';

// =============================================================================
// Hooks
// =============================================================================

export {
  // Primary hook
  useConnectionPort,
  type UseConnectionPortOptions,
  type UseConnectionPortReturn,
  // Low-level subscription
  useStreamSubscription,
  type UseStreamSubscriptionOptions,
  type UseStreamSubscriptionReturn,
  // Generic stream atom hook
  useAtomStream,
  useAtomStreamSuspense,
  type UseAtomStreamReturn,
} from './hooks';

// =============================================================================
// Layer Schemas & Builder
// =============================================================================

export {
  // Layer configs
  ScatterplotLayerConfig,
  IconLayerConfig,
  PathLayerConfig,
  PolygonLayerConfig,
  HexagonLayerConfig,
  GeoJsonLayerConfig,
  LayerConfig,
  LayerConfigs,
  // Block-specific render options
  MapRenderOptions,
  Scene3DRenderOptions,
  DataGridRenderOptions,
  ChartRenderOptions,
} from './schemas/layers';

export {
  // Layer builder
  buildLayersFromSpec,
  buildLayersFromSpecSync,
  type LayerBuildContext,
  type LayerBuildResult,
  type LayerBuildError,
} from './layers';
