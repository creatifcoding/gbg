/**
 * EnterpriseEntity - Effect Cluster Entity for Enterprise Lifecycle
 *
 * Manages ISA-95 asset hierarchy enterprise-level lifecycle with state machine transitions.
 *
 * ARCHITECTURE (Machine + Entity):
 * - External API: Rpc.make() definitions (PRESERVED)
 * - Internal: Machine booted at handler init, delegates via actor.send()
 * - Graph validation: Enterprise state transitions validated in Machine
 * - StateService: Wrapped by Machine procedures
 *
 * Entity Lifecycle:
 * - Create: Initialize enterprise
 * - Get: Read current enterprise state
 * - Restructure: Begin restructuring (active -> restructuring)
 * - CompleteRestructuring: Finish restructuring (restructuring -> active)
 * - Merge: Merge enterprise (active -> merged, terminal)
 * - Dissolve: Dissolve enterprise (active|restructuring -> dissolved, terminal)
 *
 * @module
 */

import { Schema, Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import { Enterprise, CreateEnterpriseParams } from '../schemas/assets/enterprise'
import { EnterpriseId } from '../schemas/identifiers'
import { EnterpriseState } from '../state'
import { IIoTFeatureFlags } from '../infrastructure/feature-flags'
import {
  makeEnterpriseMachine,
  InternalCreateEnterprise,
  InternalGetEnterprise,
  InternalRestructure,
  InternalCompleteRestructuring,
  InternalMerge,
  InternalDissolve,
} from '../machines/EnterpriseMachine'

// =============================================================================
// RPC Error Schemas
// =============================================================================

/** Enterprise not found error */
export class RpcNotFoundError extends Schema.TaggedError<RpcNotFoundError>()(
  'RpcEnterpriseNotFoundError',
  {
    enterpriseId: EnterpriseId,
  }
) {}

/** Enterprise transition error (invalid state transition) */
export class RpcTransitionError extends Schema.TaggedError<RpcTransitionError>()(
  'RpcEnterpriseTransitionError',
  {
    enterpriseId: EnterpriseId,
    message: Schema.String,
  }
) {}

/** Enterprise query error */
export class RpcQueryError extends Schema.TaggedError<RpcQueryError>()(
  'RpcEnterpriseQueryError',
  {
    operation: Schema.String,
    message: Schema.String,
  }
) {}

// =============================================================================
// RPC Tags
// =============================================================================

export const EnterpriseEntityType = 'Enterprise' as const
export const EnterpriseCreateTag = `${EnterpriseEntityType}.Create` as const
export const EnterpriseGetTag = `${EnterpriseEntityType}.Get` as const
export const EnterpriseRestructureTag = `${EnterpriseEntityType}.Restructure` as const
export const EnterpriseCompleteRestructuringTag = `${EnterpriseEntityType}.CompleteRestructuring` as const
export const EnterpriseMergeTag = `${EnterpriseEntityType}.Merge` as const
export const EnterpriseDissolveTag = `${EnterpriseEntityType}.Dissolve` as const

// =============================================================================
// RPC Definitions
// =============================================================================

/**
 * Create a new enterprise
 */
export class CreateEnterpriseRpc extends Rpc.make(EnterpriseCreateTag, {
  payload: CreateEnterpriseParams,
  primaryKey: ({ slug }) => slug,
  success: Enterprise,
  error: RpcQueryError,
}) {}

/**
 * Get enterprise by ID
 */
export class GetEnterpriseRpc extends Rpc.make(EnterpriseGetTag, {
  payload: Schema.Struct({
    enterpriseId: EnterpriseId,
  }),
  primaryKey: ({ enterpriseId }) => enterpriseId,
  success: Enterprise,
  error: RpcNotFoundError,
}) {}

/**
 * Restructure an enterprise (active -> restructuring)
 */
export class RestructureRpc extends Rpc.make(EnterpriseRestructureTag, {
  payload: Schema.Struct({
    enterpriseId: EnterpriseId,
  }),
  primaryKey: ({ enterpriseId }) => enterpriseId,
  success: Enterprise,
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

/**
 * Complete restructuring (restructuring -> active)
 */
export class CompleteRestructuringRpc extends Rpc.make(EnterpriseCompleteRestructuringTag, {
  payload: Schema.Struct({
    enterpriseId: EnterpriseId,
  }),
  primaryKey: ({ enterpriseId }) => enterpriseId,
  success: Enterprise,
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

/**
 * Merge enterprise (active -> merged, terminal)
 */
export class MergeRpc extends Rpc.make(EnterpriseMergeTag, {
  payload: Schema.Struct({
    enterpriseId: EnterpriseId,
  }),
  primaryKey: ({ enterpriseId }) => enterpriseId,
  success: Enterprise,
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

/**
 * Dissolve enterprise (active|restructuring -> dissolved, terminal)
 */
export class DissolveRpc extends Rpc.make(EnterpriseDissolveTag, {
  payload: Schema.Struct({
    enterpriseId: EnterpriseId,
  }),
  primaryKey: ({ enterpriseId }) => enterpriseId,
  success: Enterprise,
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

/**
 * Enterprise Entity
 *
 * Distributed actor managing enterprise lifecycle state.
 * Each enterprise instance is keyed by enterpriseId and maintains
 * entity-scoped state via Effect.Ref.
 */
export const EnterpriseEntity = Entity.make(EnterpriseEntityType, [
  CreateEnterpriseRpc,
  GetEnterpriseRpc,
  RestructureRpc,
  CompleteRestructuringRpc,
  MergeRpc,
  DissolveRpc,
])

/**
 * Type helper for Enterprise Entity
 */
export type EnterpriseEntity = typeof EnterpriseEntity

// =============================================================================
// Handler Implementation (delegates to Machine)
// =============================================================================

/**
 * EnterpriseEntity handler layer
 *
 * ARCHITECTURE (Machine + Entity):
 * - Boots EnterpriseMachine at initialization
 * - Handlers delegate to Machine via actor.send()
 * - Machine validates state transitions via enterprise graph
 * - StateService wrapped by Machine procedures
 */
export const EnterpriseEntityHandlers = EnterpriseEntity.toLayer(
  Effect.gen(function* () {
    // ─────────────────────────────────────────────────────────────────────────
    // PORT INJECTION
    // ─────────────────────────────────────────────────────────────────────────
    const state = yield* EnterpriseState       // Port: state persistence
    const flags = yield* IIoTFeatureFlags      // Port: feature flags

    // ─────────────────────────────────────────────────────────────────────────
    // MACHINE BOOT (internal actor)
    // ─────────────────────────────────────────────────────────────────────────
    const enterpriseMachine = makeEnterpriseMachine({ state, flags })
    const actor = yield* Machine.boot(enterpriseMachine)

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLERS DELEGATE TO MACHINE
    // ─────────────────────────────────────────────────────────────────────────

    const handleCreate = (envelope: {
      payload: typeof CreateEnterpriseParams.Type
    }) =>
      actor.send(new InternalCreateEnterprise({ params: envelope.payload })).pipe(
        Effect.catchTag('MachineCreateError', (e) =>
          Effect.fail(new RpcQueryError({ operation: 'create', message: e.message }))
        )
      )

    const handleGet = (envelope: { payload: { enterpriseId: EnterpriseId } }) =>
      actor.send(new InternalGetEnterprise({ enterpriseId: envelope.payload.enterpriseId })).pipe(
        Effect.catchTag('MachineEntityNotFoundError', (e) =>
          Effect.fail(new RpcNotFoundError({ enterpriseId: e.entityId as EnterpriseId }))
        ),
        Effect.tapError((e) =>
          Effect.logWarning(`Get: ${e._tag} for enterprise ${envelope.payload.enterpriseId}`)
        )
      )

    const handleRestructure = (envelope: { payload: { enterpriseId: EnterpriseId } }) =>
      actor.send(new InternalRestructure({ enterpriseId: envelope.payload.enterpriseId })).pipe(
        Effect.catchTags({
          MachineEntityNotFoundError: (e) =>
            Effect.fail(new RpcNotFoundError({ enterpriseId: e.entityId as EnterpriseId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcTransitionError({ enterpriseId: e.entityId as EnterpriseId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Restructure: ${e._tag} for enterprise ${envelope.payload.enterpriseId}`)
        )
      )

    const handleCompleteRestructuring = (envelope: { payload: { enterpriseId: EnterpriseId } }) =>
      actor.send(new InternalCompleteRestructuring({ enterpriseId: envelope.payload.enterpriseId })).pipe(
        Effect.catchTags({
          MachineEntityNotFoundError: (e) =>
            Effect.fail(new RpcNotFoundError({ enterpriseId: e.entityId as EnterpriseId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcTransitionError({ enterpriseId: e.entityId as EnterpriseId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`CompleteRestructuring: ${e._tag} for enterprise ${envelope.payload.enterpriseId}`)
        )
      )

    const handleMerge = (envelope: { payload: { enterpriseId: EnterpriseId } }) =>
      actor.send(new InternalMerge({ enterpriseId: envelope.payload.enterpriseId })).pipe(
        Effect.catchTags({
          MachineEntityNotFoundError: (e) =>
            Effect.fail(new RpcNotFoundError({ enterpriseId: e.entityId as EnterpriseId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcTransitionError({ enterpriseId: e.entityId as EnterpriseId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Merge: ${e._tag} for enterprise ${envelope.payload.enterpriseId}`)
        )
      )

    const handleDissolve = (envelope: { payload: { enterpriseId: EnterpriseId } }) =>
      actor.send(new InternalDissolve({ enterpriseId: envelope.payload.enterpriseId })).pipe(
        Effect.catchTags({
          MachineEntityNotFoundError: (e) =>
            Effect.fail(new RpcNotFoundError({ enterpriseId: e.entityId as EnterpriseId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcTransitionError({ enterpriseId: e.entityId as EnterpriseId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Dissolve: ${e._tag} for enterprise ${envelope.payload.enterpriseId}`)
        )
      )

    return EnterpriseEntity.of({
      [EnterpriseCreateTag]: handleCreate,
      [EnterpriseGetTag]: handleGet,
      [EnterpriseRestructureTag]: handleRestructure,
      [EnterpriseCompleteRestructuringTag]: handleCompleteRestructuring,
      [EnterpriseMergeTag]: handleMerge,
      [EnterpriseDissolveTag]: handleDissolve,
    })
  })
)
