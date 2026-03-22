/**
 * CardEntity - Effect Cluster for Distributed Card Operations
 *
 * Implements distributed AI-powered card operations:
 * - Chat (streaming LLM responses)
 * - UI Generation (progressive UI patches)
 * - Chart Styling (LLM-driven chart customization)
 * - Morph Agents (fix/evolve operations)
 *
 * Sharding strategy: By cardId hash to 8 shard groups for session affinity.
 *
 * @see Slice 1 of Clusterized Cursor Architecture
 * @module cursor/cluster/CardEntity
 */

import { Schema, Effect } from 'effect'
import { Entity, ClusterSchema } from '@effect/cluster'
import { Rpc, RpcSchema } from '@effect/rpc'

// =============================================================================
// Core Identifiers (Branded Types)
// =============================================================================

/**
 * Branded CardId for type safety
 */
export const CardId = Schema.String.pipe(Schema.brand('CardId'))
export type CardId = typeof CardId.Type

/**
 * Branded OperationId for tracking in-flight operations
 */
export const OperationId = Schema.String.pipe(Schema.brand('OperationId'))
export type OperationId = typeof OperationId.Type

// =============================================================================
// Error Types
// =============================================================================

/**
 * Base error for card entity operations
 */
export class CardEntityError extends Schema.TaggedError<CardEntityError>()(
  'CardEntityError',
  {
    operation: Schema.String,
    cardId: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
    retryable: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  }
) {}

/**
 * Operation cancelled by user
 */
export class OperationCancelledError extends Schema.TaggedError<OperationCancelledError>()(
  'OperationCancelledError',
  {
    operationId: Schema.String,
    cardId: Schema.String,
  }
) {}

/**
 * AI provider error (Claude API, etc.)
 */
export class AIProviderError extends Schema.TaggedError<AIProviderError>()(
  'AIProviderError',
  {
    provider: Schema.String,
    statusCode: Schema.optional(Schema.Number),
    message: Schema.String,
    retryable: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  }
) {}

// =============================================================================
// Shared Schemas
// =============================================================================

/**
 * Chat message for conversation history
 */
export const ChatMessage = Schema.Struct({
  role: Schema.Literal('user', 'assistant', 'system', 'tool'),
  content: Schema.String,
  name: Schema.optional(Schema.String),
  toolCallId: Schema.optional(Schema.String),
})
export type ChatMessage = typeof ChatMessage.Type

/**
 * Card state snapshot
 */
export const CardState = Schema.Struct({
  cardId: CardId,
  activeOperations: Schema.Array(OperationId),
  lastActivity: Schema.DateFromSelf,
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export type CardState = typeof CardState.Type

// =============================================================================
// RPC Group 1: Chat (Streaming Primary)
// =============================================================================

/**
 * Chat request payload
 */
export const ChatPayload = Schema.Struct({
  cardId: CardId,
  operationId: OperationId,
  prompt: Schema.String,
  mode: Schema.optionalWith(Schema.Literal('terminal', 'cursor'), { default: () => 'cursor' as const }),
  history: Schema.optionalWith(Schema.Array(ChatMessage), { default: () => [] }),
})
export type ChatPayload = typeof ChatPayload.Type

/**
 * Streaming chat response chunks
 */
export const ChatChunk = Schema.Union(
  Schema.TaggedStruct('TextDelta', {
    text: Schema.String,
  }),
  Schema.TaggedStruct('ToolCall', {
    toolCallId: Schema.String,
    name: Schema.String,
    args: Schema.Unknown,
  }),
  Schema.TaggedStruct('ToolResult', {
    toolCallId: Schema.String,
    name: Schema.String,
    result: Schema.Unknown,
  }),
  Schema.TaggedStruct('Done', {
    finishReason: Schema.Literal('stop', 'length', 'tool_calls', 'content_filter', 'error'),
    usage: Schema.optional(Schema.Struct({
      promptTokens: Schema.Number,
      completionTokens: Schema.Number,
    })),
  })
)
export type ChatChunk = typeof ChatChunk.Type

/**
 * Stream chat RPC - primary interface for conversational AI
 */
export class StreamChatRpc extends Rpc.make('StreamChat', {
  payload: ChatPayload,
  success: RpcSchema.Stream({
    success: ChatChunk,
    failure: Schema.Union(CardEntityError, AIProviderError, OperationCancelledError),
  }),
  error: CardEntityError,
}) {}

// =============================================================================
// RPC Group 2: UI Generation (Streaming Primary)
// =============================================================================

/**
 * UI generation request payload
 */
export const UIGeneratePayload = Schema.Struct({
  cardId: CardId,
  operationId: OperationId,
  prompt: Schema.String,
  catalog: Schema.optionalWith(Schema.String, { default: () => 'default' }),
  context: Schema.optional(Schema.Unknown),
})
export type UIGeneratePayload = typeof UIGeneratePayload.Type

// Import JsonPatch from canonical source
import { JsonPatch, PatchOp } from '../../genifer/core/schemas'
export { JsonPatch, PatchOp }
export type { JsonPatch as JsonPatchType, PatchOp as PatchOpType }

/**
 * Stream UI generation RPC - emits JsonPatch
 */
export class StreamUIGenerateRpc extends Rpc.make('StreamUIGenerate', {
  payload: UIGeneratePayload,
  success: RpcSchema.Stream({
    success: JsonPatch,
    failure: Schema.Union(CardEntityError, AIProviderError, OperationCancelledError),
  }),
  error: CardEntityError,
}) {}

// =============================================================================
// RPC Group 3: Chart Styling (Streaming Primary)
// =============================================================================

/**
 * Chart style request payload
 */
export const ChartStylePayload = Schema.Struct({
  cardId: CardId,
  operationId: OperationId,
  chartSpec: Schema.Unknown,
  instruction: Schema.optional(Schema.String),
  theme: Schema.optional(Schema.String),
})
export type ChartStylePayload = typeof ChartStylePayload.Type

/**
 * Chart style patch types
 */
export const StylePatch = Schema.Union(
  Schema.TaggedStruct('OptionUpdate', {
    path: Schema.String,
    value: Schema.Unknown,
  }),
  Schema.TaggedStruct('ThemeApply', {
    theme: Schema.String,
    overrides: Schema.optional(Schema.Unknown),
  }),
  Schema.TaggedStruct('ColorUpdate', {
    target: Schema.Literal('series', 'axis', 'background', 'text'),
    colors: Schema.Array(Schema.String),
  }),
  Schema.TaggedStruct('Done', {
    totalPatches: Schema.Number,
  })
)
export type StylePatch = typeof StylePatch.Type

/**
 * Stream chart styling RPC
 */
export class StreamChartStyleRpc extends Rpc.make('StreamChartStyle', {
  payload: ChartStylePayload,
  success: RpcSchema.Stream({
    success: StylePatch,
    failure: Schema.Union(CardEntityError, AIProviderError, OperationCancelledError),
  }),
  error: CardEntityError,
}) {}

// =============================================================================
// RPC Group 4: Morph Agents (Streaming)
// =============================================================================

/**
 * Morph fix request payload (auto-fix decode errors)
 */
export const MorphFixPayload = Schema.Struct({
  cardId: CardId,
  operationId: OperationId,
  error: Schema.Struct({
    message: Schema.String,
    path: Schema.optional(Schema.String),
    expected: Schema.optional(Schema.String),
    received: Schema.optional(Schema.Unknown),
  }),
  component: Schema.Unknown,
})
export type MorphFixPayload = typeof MorphFixPayload.Type

/**
 * Morph evolve request payload (user-driven modification)
 */
export const MorphEvolvePayload = Schema.Struct({
  cardId: CardId,
  operationId: OperationId,
  instruction: Schema.String,
  currentUI: Schema.Unknown,
  constraints: Schema.optional(Schema.Array(Schema.String)),
})
export type MorphEvolvePayload = typeof MorphEvolvePayload.Type

/**
 * Morph patch types
 */
export const MorphPatch = Schema.Union(
  Schema.TaggedStruct('FixApplied', {
    path: Schema.String,
    originalValue: Schema.Unknown,
    fixedValue: Schema.Unknown,
    reason: Schema.String,
  }),
  Schema.TaggedStruct('EvolveStep', {
    stepNumber: Schema.Number,
    description: Schema.String,
    patch: Schema.Unknown,
  }),
  Schema.TaggedStruct('ValidationResult', {
    valid: Schema.Boolean,
    errors: Schema.optional(Schema.Array(Schema.String)),
  }),
  Schema.TaggedStruct('Done', {
    success: Schema.Boolean,
    totalChanges: Schema.Number,
  })
)
export type MorphPatch = typeof MorphPatch.Type

/**
 * Stream morph fix RPC
 */
export class StreamMorphFixRpc extends Rpc.make('StreamMorphFix', {
  payload: MorphFixPayload,
  success: RpcSchema.Stream({
    success: MorphPatch,
    failure: Schema.Union(CardEntityError, AIProviderError, OperationCancelledError),
  }),
  error: CardEntityError,
}) {}

/**
 * Stream morph evolve RPC
 */
export class StreamMorphEvolveRpc extends Rpc.make('StreamMorphEvolve', {
  payload: MorphEvolvePayload,
  success: RpcSchema.Stream({
    success: MorphPatch,
    failure: Schema.Union(CardEntityError, AIProviderError, OperationCancelledError),
  }),
  error: CardEntityError,
}) {}

// =============================================================================
// RPC Group 5: Operations Control
// =============================================================================

/**
 * Cancel operation request
 */
export const CancelOperationPayload = Schema.Struct({
  cardId: CardId,
  operationId: OperationId,
  reason: Schema.optional(Schema.String),
})
export type CancelOperationPayload = typeof CancelOperationPayload.Type

/**
 * Cancel an in-flight operation
 */
export class CancelOperationRpc extends Rpc.make('CancelOperation', {
  payload: CancelOperationPayload,
  success: Schema.Void,
  error: CardEntityError,
}) {}

/**
 * Get card state request
 */
export const GetCardStatePayload = Schema.Struct({
  cardId: CardId,
})
export type GetCardStatePayload = typeof GetCardStatePayload.Type

/**
 * Get current card state
 */
export class GetCardStateRpc extends Rpc.make('GetCardState', {
  payload: GetCardStatePayload,
  success: CardState,
  error: CardEntityError,
}) {}

// =============================================================================
// Sharding Utilities
// =============================================================================

/**
 * Simple string hash for shard distribution
 * Uses djb2 algorithm for consistent hashing
 */
function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  return Math.abs(hash)
}

/**
 * Number of shard groups for card distribution
 */
export const CARD_SHARD_COUNT = 8

/**
 * Shard groups for card cluster runners
 */
export const CARD_SHARD_GROUPS = [
  'card-shard-0',
  'card-shard-1',
  'card-shard-2',
  'card-shard-3',
  'card-shard-4',
  'card-shard-5',
  'card-shard-6',
  'card-shard-7',
] as const

export type CardShardGroup = (typeof CARD_SHARD_GROUPS)[number]

/**
 * Get shard group for a given cardId
 */
export function getShardGroup(cardId: string): CardShardGroup {
  const shardIndex = hashString(cardId) % CARD_SHARD_COUNT
  return CARD_SHARD_GROUPS[shardIndex]
}

// =============================================================================
// Entity Definition
// =============================================================================

/**
 * CardEntity - Distributed actor for card operations
 *
 * Handles all AI-powered card operations with streaming-first design.
 * Uses cardId-based sharding for session affinity.
 *
 * Usage:
 * ```typescript
 * const client = yield* CardEntity.client
 * const stream = yield* client(cardId).send(
 *   new StreamChatRpc({ cardId, operationId, prompt: 'Hello' })
 * )
 * ```
 */
export const CardEntity = Entity.make('Card', [
  // Chat
  StreamChatRpc,
  // UI Generation
  StreamUIGenerateRpc,
  // Chart Styling
  StreamChartStyleRpc,
  // Morph Agents
  StreamMorphFixRpc,
  StreamMorphEvolveRpc,
  // Operations Control
  CancelOperationRpc,
  GetCardStateRpc,
]).annotate(ClusterSchema.ShardGroup, (entityId) => {
  // entityId is the cardId - route to appropriate shard
  return getShardGroup(entityId)
})

/**
 * Type helper for CardEntity
 */
export type CardEntity = typeof CardEntity

/**
 * CardEntity client type for consumers
 * Extracts the success type from the Effect returned by CardEntity.client
 */
export type CardEntityClient = Effect.Effect.Success<typeof CardEntity.client>
