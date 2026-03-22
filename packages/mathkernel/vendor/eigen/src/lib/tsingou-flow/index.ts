/**
 * @tmnl/tsingou-flow — Differential Dataflow Signal Pipeline
 *
 * The nervous system of the Tsingou platform. Ingests signals from arbitrary
 * sources, processes them incrementally via d2ts differential dataflow, and
 * delivers derived state to rendering layers (R3F, p5, visx, DOM).
 *
 * Architecture:
 *   Source Adapters → Effect.Queue → TsingouFlow drain → d2ts graphs → OutputBridge → Atoms → React
 *
 * All adapters are Effect.Service instances with scoped lifecycle.
 * All mutable state is Atom.make() — React subscribes directly (Atom-as-State).
 * All errors are Data.TaggedError — typed error channels throughout.
 * All Holonet services are injected via Layer composition.
 *
 * Named after Mary Tsingou (1928–2023), MANIAC programmer at Los Alamos.
 *
 * @module tsingou-flow
 */

// =============================================================================
// Schemas
// =============================================================================

export {
  // Base signal + branded IDs
  SignalId,
  SourceId,
  SessionId,
  SignalVersion,
  KnownSignalKind,
  SignalKind,
  SignalMetadata,
  BaseSignal,

  // Source-specific signals
  MidiSignal,
  MidiPayload,
  MidiMessageType,
  OscSignal,
  OscPayload,
  OscArgument,
  NatsSignal,
  NatsPayload,
  HttpSignal,
  HttpPayload,
  HttpMethod,
  SerialSignal,
  SerialPayload,
  SerialParserType,
  RssSignal,
  RssPayload,
  WebSocketSignal,
  WebSocketPayload,
  WebSocketMessageType,
  FileWatchSignal,
  FileWatchPayload,
  FileWatchEventType,

  // Discriminated union
  Signal,

  // Schema registry
  SchemaRegistryEntry,
  SchemaCompatibility,

  // Adapter operational types
  AdapterStatus,
  AdapterHealth,
  AdapterError,
  AdapterLifecycleEvent,
} from './schemas'

// =============================================================================
// Adapter Contract + Primitives
// =============================================================================

export {
  type SourceAdapterShape,
  type AdapterInternals,
  makeAdapterInternals,
  generateSignalId,
  SignalQueueTag,
} from './adapters/types'

// =============================================================================
// Adapters — Real
// =============================================================================

export { NatsSourceAdapter, NatsAdapterConfig, NatsAdapterConfigTag } from './adapters/NatsAdapter'
export { HttpSourceAdapter, HttpAdapterConfig, HttpAdapterConfigTag } from './adapters/HttpAdapter'
export { WebSocketSourceAdapter, WsAdapterConfig, WsAdapterConfigTag } from './adapters/WebSocketAdapter'
export {
  RssSourceAdapter,
  RssAdapterConfig,
  RssAdapterConfigTag,
  RssFeedManagerService,
  feedManagerStateAtom,
} from './adapters/RssAdapter'

// =============================================================================
// Adapters — Holonet Bridge (sidecar pattern)
// =============================================================================

export {
  HolonetBridgeAdapter,
  HolonetBridgeConfig,
  HolonetBridgeConfigTag,
  makeFileWatchBridgeConfig,
  makeSerialBridgeConfig,
  makeOscBridgeConfig,
} from './adapters/HolonetBridgeAdapter'

// =============================================================================
// Adapters — Stubs
// =============================================================================

export { MidiSourceAdapter, MidiAdapterConfig, MidiAdapterConfigTag } from './adapters/MidiAdapter'
export { OscSourceAdapter, OscAdapterConfig, OscAdapterConfigTag } from './adapters/OscAdapter'

// =============================================================================
// Adapter Errors
// =============================================================================

export {
  AdapterConnectError,
  HttpRequestError,
  HttpParseError,
  HttpAuthError,
  HttpTimeoutError,
  SseConnectionError,
  WsConnectError,
  WsMessageError,
  NatsSubscribeError,
  FileWatchError,
  FileParseError,
  RssFetchError,
  RssParseError,
  SerialConnectError,
  SignalValidationError,
  SignalQueueFullError,
} from './adapters/errors'

// =============================================================================
// XML Parser (Effect boundary)
// =============================================================================

export {
  parseXml,
  parseRssFeed,
  extractItemId,
  XmlParseError,
  XmlValidationError,
  RssItemSchema,
  AtomEntrySchema,
} from './adapters/xml'

// =============================================================================
// Services
// =============================================================================

export {
  AdapterManager,
  AdapterManagerError,
  adapterRegistryAtom,
  adapterHealthAtom,
  totalSignalCountAtom,
  lifecycleEventsAtom,
  type AdapterManagerShape,
  type RegisteredAdapter,
} from './services/AdapterManager'

export {
  TsingouSchemaRegistry,
  runtimeSchemasAtom,
  schemaCountAtom,
} from './services/SchemaRegistry'

export {
  makeOutputBridge,
  activeSignalsAtom,
  derivedSignalCountAtom,
  pipelineLatencyAtom,
  type OutputBridgeShape,
  type OutputBridgeConfig,
} from './services/OutputBridge'

export {
  TsingouFlow,
  TsingouFlowLive,
  tickAtom,
  pipelineStatusAtom,
  tickSignalCountAtom,
  cycleDurationMsAtom,
  totalProcessedAtom,
  throughputAtom,
  type TsingouFlowShape,
} from './services/TsingouFlow'

// =============================================================================
// Graph Utilities
// =============================================================================

export {
  makeVersion,
  initialVersion,
  advanceTick,
  advanceSource,
  getTick,
  getSourceSeq,
  compareVersions,
  TICK_DIM,
  SOURCE_DIM,
} from './graph/version'

export {
  fromSignal,
  retractSignal,
  fromBatch,
  fromEntries,
  empty as emptyMultiSet,
  merge as mergeMultiSets,
  netCount,
  activeEntries,
  mapMultiSet,
  type MultiSet,
  type MultiSetEntry,
} from './graph/multiset-helpers'

// =============================================================================
// Operators
// =============================================================================

export {
  windowOperator,
  type WindowConfig,
} from './operators/window'

export {
  throttleOperator,
  type ThrottleConfig,
} from './operators/throttle'

export {
  schemaValidateOperator,
  type SchemaValidateConfig,
} from './operators/schema-validate'
