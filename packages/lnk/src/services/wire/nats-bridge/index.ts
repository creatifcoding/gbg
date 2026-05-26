/**
 * NATS bridge wire skeleton.
 *
 * Exposes the port contract and guarded Wire layer for the future
 * @tmnl/msh-backed durable stream adapter.
 *
 * @module @tmnl/lnk/services/wire/nats-bridge
 */

export {
  NatsBridgeWire,
  DEFAULT_NATS_BRIDGE_OPTIONS,
  resolveNatsBridgeWireOptions,
  type NatsBridgeWireOptions,
  type ResolvedNatsBridgeWireOptions,
} from "./NatsBridgeWire.js"

export {
  MshBridgeWire,
  DEFAULT_MSH_BRIDGE_OPTIONS,
  resolveMshBridgeWireOptions,
  type MshBridgeWireOptions,
  type ResolvedMshBridgeWireOptions,
} from "./MshBridgeWire.js"

export {
  NatsBridgePort,
  type NatsBridgePortShape,
  type NatsBridgeStreamMetadata,
  type NatsBridgeAppendInput,
  type NatsBridgeAppendResult,
  type NatsBridgeReadInput,
  type NatsBridgeReadResult,
} from "./Port.js"

export {
  MshBridgePort,
  type MshBridgePortShape,
  type MshBridgeStreamMetadata,
  type MshBridgeAppendInput,
  type MshBridgeAppendResult,
  type MshBridgeReadInput,
  type MshBridgeReadResult,
} from "./MshBridgePort.js"

export {
  CasMetadataStore,
  MetadataCasConflictError,
  type CasMetadataStoreShape,
  type MetadataStoreError,
  type RevisionedMetadata,
} from "./CasMetadataStore.js"

export {
  ShardGuard,
  DEFAULT_SHARD_COUNT,
  type ShardGuardOptions,
  type ShardGuardShape,
} from "./ShardGuard.js"

export {
  BatchPublisher,
  PublishExpectationConflictError,
  type BatchPublisherShape,
  type PublishBatchInput,
  type PublishBatchAck,
} from "./BatchPublisher.js"

export { MshCasMetadataStore } from "./MshCasMetadataStore.js"
export { MshBatchPublisher } from "./MshBatchPublisher.js"
export { MshBridgePortLive } from "./MshBridgePortLive.js"
export {
  DEFAULT_MSH_BRIDGE_SUBSTRATE_OPTIONS,
  metadataKeyForStream,
  resolveMshBridgeSubstrateOptions,
  safeStreamToken,
  streamNameForStream,
  subjectForStream,
  type MshBridgeSubstrateOptions,
  type ResolvedMshBridgeSubstrateOptions,
} from "./MshBridgeConfig.js"

export {
  appendWithCas,
  type CasAppendOptions,
  type CasAppendError,
} from "./CasAppend.js"

export { MshBridgeSpan, type MshBridgeSpanName } from "./spans.js"

export {
  MshBridgeDiagnostics,
  makeMshBridgeDiagnostics,
  mshBridgeDiagnosticsLayer,
  type MshBridgeDiagnosticsShape,
} from "./MshBridgeDiagnostics.js"

export {
  AppendIntent,
  ProducerState,
  makeAppendIntent,
  toDurableAppendInput,
  toDurableCreateInput,
  type AppendIntentInput,
} from "./intents.js"

export * as DurableStreamKernel from "./kernel.js"
export {
  DurableStreamMetadata,
  DurableProducerState,
  DurableBatchEnvelope,
  DurableBatchMessage,
  makeInitialMetadata,
  makeMshOffset,
  decodeMshOffset,
  positionToStartSeq,
  planCreate,
  planAppend,
  type DurableCreateInput,
  type DurableCreatePlan,
  type DurableAppendInput,
  type DurableAppendResult,
  type DurableAppendPlan,
  type DurableAppendDuplicatePlan,
  type DurableAppendMetadataOnlyPlan,
  type DurableAppendPublishPlan,
  type PublishAckInput,
  type DecodedMshOffset,
} from "./kernel.js"
