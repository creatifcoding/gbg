/**
 * Cursor Cluster Module
 *
 * Effect Cluster entities for distributed card operations.
 * Provides streaming-first AI-powered card functionality with session affinity.
 *
 * @module cursor/cluster
 */

// =============================================================================
// Entity Exports
// =============================================================================

export {
  // Entity
  CardEntity,
  type CardEntityClient,
  // Identifiers
  CardId,
  OperationId,
  type CardId as CardIdType,
  type OperationId as OperationIdType,
  // Errors
  CardEntityError,
  OperationCancelledError,
  AIProviderError,
  // Shared Schemas
  ChatMessage,
  CardState,
  type ChatMessage as ChatMessageType,
  type CardState as CardStateType,
  // Chat RPCs
  ChatPayload,
  ChatChunk,
  StreamChatRpc,
  type ChatPayload as ChatPayloadType,
  type ChatChunk as ChatChunkType,
  // UI Generation RPCs
  UIGeneratePayload,
  JsonPatch,
  PatchOp,
  StreamUIGenerateRpc,
  type UIGeneratePayload as UIGeneratePayloadType,
  type JsonPatch as JsonPatchType,
  type PatchOp as PatchOpType,
  // Chart Styling RPCs
  ChartStylePayload,
  StylePatch,
  StreamChartStyleRpc,
  type ChartStylePayload as ChartStylePayloadType,
  type StylePatch as StylePatchType,
  // Morph RPCs
  MorphFixPayload,
  MorphEvolvePayload,
  MorphPatch,
  StreamMorphFixRpc,
  StreamMorphEvolveRpc,
  type MorphFixPayload as MorphFixPayloadType,
  type MorphEvolvePayload as MorphEvolvePayloadType,
  type MorphPatch as MorphPatchType,
  // Operations Control RPCs
  CancelOperationPayload,
  CancelOperationRpc,
  GetCardStatePayload,
  GetCardStateRpc,
  type CancelOperationPayload as CancelOperationPayloadType,
  type GetCardStatePayload as GetCardStatePayloadType,
  // Sharding
  CARD_SHARD_COUNT,
  CARD_SHARD_GROUPS,
  type CardShardGroup,
  getShardGroup,
} from './CardEntity'

// =============================================================================
// Handler Exports
// =============================================================================

export {
  CardEntityHandlers,
  CardEntityLayer,
} from './CardEntityHandlers'

// =============================================================================
// Client Layer (for browser use)
// =============================================================================

export {
  ClusterClientLayer,
  ClusterClientLayerLocal,
  DEFAULT_CONFIG as DEFAULT_CLUSTER_CONFIG,
  type ClusterClientConfig,
} from './ClusterClientLayer'
