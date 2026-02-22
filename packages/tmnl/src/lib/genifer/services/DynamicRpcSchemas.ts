/**
 * DynamicRpcSchemas — @effect/rpc definitions for the dynamic RPC management API.
 *
 * The management interface (register, call, list, unregister) is defined as
 * proper @effect/rpc RPCs — fully typed, serializable, exposable over HTTP.
 *
 * The dispatched handlers themselves are runtime-defined (the whole point),
 * but the management API that governs them uses canonical Effect RPC patterns.
 *
 * @module genifer/services/DynamicRpcSchemas
 */

import { Rpc, RpcGroup } from '@effect/rpc'
import { Schema } from 'effect'

// =============================================================================
// Handler Types — how a dynamic RPC is executed
// =============================================================================

export const HttpHandler = Schema.TaggedStruct('http', {
  url: Schema.String,
  method: Schema.optional(Schema.Literal('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
  headers: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  bodyTemplate: Schema.optional(Schema.String),
})

export const ServiceHandler = Schema.TaggedStruct('service', {
  serviceTag: Schema.String,
  method: Schema.String,
})

export const LlmHandler = Schema.TaggedStruct('llm', {
  promptTemplate: Schema.String,
  model: Schema.optional(Schema.String),
  maxTokens: Schema.optional(Schema.Number),
})

export const ScriptHandler = Schema.TaggedStruct('script', {
  code: Schema.String,
  language: Schema.optional(Schema.Literal('typescript', 'javascript')),
})

export const CustomHandler = Schema.TaggedStruct('custom', {
  handlerId: Schema.String,
})

export const RpcHandler = Schema.Union(
  HttpHandler,
  ServiceHandler,
  LlmHandler,
  ScriptHandler,
  CustomHandler,
)
export type RpcHandler = typeof RpcHandler.Type

// =============================================================================
// RPC Definition — what gets registered
// =============================================================================

export class RpcDefinition extends Schema.Class<RpcDefinition>('RpcDefinition')({
  tag: Schema.String,
  description: Schema.optional(Schema.String),
  payloadSchema: Schema.optional(Schema.Unknown),
  resultSchema: Schema.optional(Schema.Unknown),
  handler: RpcHandler,
  source: Schema.optional(Schema.Literal('decorator', 'dynamic', 'code-mode')),
  registeredAt: Schema.optional(Schema.Number),
}) {}

// =============================================================================
// Tagged Errors
// =============================================================================

export class DynamicRpcNotFound extends Schema.TaggedError<DynamicRpcNotFound>()(
  'DynamicRpcNotFound',
  { tag: Schema.String, message: Schema.String },
) {}

export class DynamicRpcHandlerError extends Schema.TaggedError<DynamicRpcHandlerError>()(
  'DynamicRpcHandlerError',
  { tag: Schema.String, message: Schema.String, cause: Schema.optional(Schema.Unknown) },
) {}

// =============================================================================
// RPC Definitions — management API via @effect/rpc
// =============================================================================

/** Register a new dynamic RPC handler */
export class RegisterDynamicRpc extends Rpc.make('RegisterDynamicRpc', {
  payload: { definition: RpcDefinition },
  success: Schema.Void,
}) {}

/** Unregister a dynamic RPC by tag */
export class UnregisterDynamicRpc extends Rpc.make('UnregisterDynamicRpc', {
  payload: { tag: Schema.String },
  success: Schema.Void,
  error: DynamicRpcNotFound,
}) {}

/** Call a dynamic RPC — dispatches to the registered handler */
export class CallDynamicRpc extends Rpc.make('CallDynamicRpc', {
  payload: { tag: Schema.String, data: Schema.Unknown },
  success: Schema.Unknown,
  error: Schema.Union(DynamicRpcNotFound, DynamicRpcHandlerError),
}) {}

/** List all registered dynamic RPCs */
export class ListDynamicRpcs extends Rpc.make('ListDynamicRpcs', {
  success: Schema.Array(RpcDefinition),
}) {}

/** Get a single dynamic RPC definition by tag */
export class GetDynamicRpc extends Rpc.make('GetDynamicRpc', {
  payload: { tag: Schema.String },
  success: RpcDefinition,
  error: DynamicRpcNotFound,
}) {}

// =============================================================================
// RPC Group — the complete management API
// =============================================================================

export class DynamicRpcGroup extends RpcGroup.make(
  RegisterDynamicRpc,
  UnregisterDynamicRpc,
  CallDynamicRpc,
  ListDynamicRpcs,
  GetDynamicRpc,
) {}
