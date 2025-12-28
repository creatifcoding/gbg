/**
 * Connection Ports Schemas
 *
 * @module connection-ports/schemas
 */

// Connection configuration
export {
  StreamId,
  NatsSubject,
  DurableStreamUrl,
  StreamOffset,
  NatsConfig,
  DurableStreamsConfig,
  ConnectionConfig,
} from './connection';

export type {
  StreamId as StreamIdType,
  NatsSubject as NatsSubjectType,
  DurableStreamUrl as DurableStreamUrlType,
  StreamOffset as StreamOffsetType,
} from './connection';

// Status tracking
export {
  ConnectionState,
  PortStatus,
  StreamState,
  StreamStatus,
  ConnectionPortsStatus,
} from './status';

export type {
  ConnectionState as ConnectionStateType,
  StreamState as StreamStateType,
} from './status';

// Error types
export {
  NatsConnectionError,
  NatsSubscriptionError,
  NatsPublishError,
  NatsKvError,
  DurableStreamsConnectionError,
  DurableStreamsReadError,
  DurableStreamsAppendError,
  StreamDecodeError,
  StreamNotFoundError,
  StreamAlreadySubscribedError,
  ConnectionBusNotInitializedError,
} from './errors';

export type {
  NatsError,
  DurableStreamsError,
  ConnectionPortsError,
} from './errors';

// View artifacts
export {
  ViewId,
  SourceId,
  EntityId,
  TraitId,
  BlockType,
  RenderSpec,
  TraitCategory,
  TraitDef,
  TraitSpec,
  PipelineStage,
  PipelineSpec,
  ViewStatus,
  ViewArtifact,
  DeltaOperation,
  EntityDelta,
  ViewDelta,
} from './artifacts';

export type {
  ViewId as ViewIdType,
  SourceId as SourceIdType,
  EntityId as EntityIdType,
  TraitId as TraitIdType,
  BlockType as BlockTypeValue,
  TraitCategory as TraitCategoryValue,
  ViewStatus as ViewStatusValue,
  DeltaOperation as DeltaOperationValue,
} from './artifacts';
