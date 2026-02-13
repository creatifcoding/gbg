/**
 * AlarmEntity - Effect Cluster Entity for Alarm Lifecycle
 *
 * Manages ISA-18.2 compliant alarm lifecycle with state machine transitions.
 * Alarms are EVENT SOURCED for full audit trail per ADR-0012.
 *
 * ARCHITECTURE (Machine + Entity):
 * - External API: Rpc.make() definitions (PRESERVED)
 * - Internal: Machine booted at handler init, delegates via actor.send()
 * - Graph validation: ISA-18.2 state transitions validated in Machine
 * - StateService: Wrapped by Machine procedures
 *
 * Entity Lifecycle:
 * - Create: Initialize alarm with entity-scoped state
 * - Get: Read current alarm state
 * - Acknowledge: Operator acknowledges alarm (graph-validated)
 * - Clear: Alarm condition resolved (graph-validated)
 *
 * @module
 */

import { Schema, Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import {
  Alarm,
  CreateAlarmParams,
  AcknowledgeAlarmParams,
} from '../schemas'
import { AlarmId } from '../schemas/identifiers'
import { AlarmState } from '../state'
import { IIoTFeatureFlags } from '../infrastructure/feature-flags'
import {
  makeAlarmMachine,
  InternalCreateAlarm,
  InternalGetAlarm,
  InternalAcknowledgeAlarm,
  InternalClearAlarm,
} from '../machines/AlarmMachine'

// =============================================================================
// RPC Error Schemas
// =============================================================================

/** Alarm not found error */
export class RpcAlarmNotFoundError extends Schema.TaggedError<RpcAlarmNotFoundError>()(
  'RpcAlarmNotFoundError',
  {
    alarmId: AlarmId,
  }
) {}

/** Alarm transition error (invalid state transition) */
export class RpcAlarmTransitionError extends Schema.TaggedError<RpcAlarmTransitionError>()(
  'RpcAlarmTransitionError',
  {
    alarmId: AlarmId,
    message: Schema.String,
  }
) {}

/** Alarm already acknowledged error (legacy - maps to transition error) */
export class RpcAlarmAlreadyAcknowledgedError extends Schema.TaggedError<RpcAlarmAlreadyAcknowledgedError>()(
  'RpcAlarmAlreadyAcknowledgedError',
  {
    alarmId: AlarmId,
  }
) {}

/** Alarm already cleared error (legacy - maps to transition error) */
export class RpcAlarmAlreadyClearedError extends Schema.TaggedError<RpcAlarmAlreadyClearedError>()(
  'RpcAlarmAlreadyClearedError',
  {
    alarmId: AlarmId,
  }
) {}

/** Alarm query error */
export class RpcQueryError extends Schema.TaggedError<RpcQueryError>()(
  'RpcQueryError',
  {
    operation: Schema.String,
    message: Schema.String,
  }
) {}

// =============================================================================
// RPC Tags
// =============================================================================

export const AlarmEntityType = 'Alarm' as const
export const AlarmCreateTag = `${AlarmEntityType}.Create` as const
export const AlarmGetTag = `${AlarmEntityType}.Get` as const
export const AlarmAcknowledgeTag = `${AlarmEntityType}.Acknowledge` as const
export const AlarmClearTag = `${AlarmEntityType}.Clear` as const

// =============================================================================
// RPC Definitions (PRESERVED - external API unchanged)
// =============================================================================

/**
 * Create a new alarm
 *
 * primaryKey routes to a specific entity instance keyed by deviceId + timestamp.
 * This ensures each alarm gets its own entity.
 */
export class CreateAlarmRpc extends Rpc.make(AlarmCreateTag, {
  payload: CreateAlarmParams,
  primaryKey: ({ deviceId }) => deviceId,
  success: Alarm,
  error: RpcQueryError,
}) {}

/**
 * Get alarm by ID
 */
export class GetAlarmRpc extends Rpc.make(AlarmGetTag, {
  payload: Schema.Struct({
    alarmId: AlarmId,
  }),
  primaryKey: ({ alarmId }) => alarmId,
  success: Alarm,
  error: RpcAlarmNotFoundError,
}) {}

/**
 * Acknowledge an alarm
 */
export class AcknowledgeAlarmRpc extends Rpc.make(AlarmAcknowledgeTag, {
  payload: AcknowledgeAlarmParams,
  primaryKey: ({ alarmId }) => alarmId,
  success: Alarm,
  error: Schema.Union(RpcAlarmNotFoundError, RpcAlarmAlreadyAcknowledgedError),
}) {}

/**
 * Clear an alarm
 */
export class ClearAlarmRpc extends Rpc.make(AlarmClearTag, {
  payload: Schema.Struct({
    alarmId: AlarmId,
  }),
  primaryKey: ({ alarmId }) => alarmId,
  success: Alarm,
  error: Schema.Union(RpcAlarmNotFoundError, RpcAlarmAlreadyClearedError),
}) {}

// =============================================================================
// Entity Definition (PRESERVED)
// =============================================================================

/**
 * Alarm Entity
 *
 * Distributed actor managing alarm lifecycle state.
 * Each alarm instance is keyed by alarmId and maintains
 * entity-scoped state via Effect.Ref.
 *
 * Sharding: Alarms are distributed across cluster nodes
 * by consistent hashing of alarmId.
 */
export const AlarmEntity = Entity.make(AlarmEntityType, [
  CreateAlarmRpc,
  GetAlarmRpc,
  AcknowledgeAlarmRpc,
  ClearAlarmRpc,
])

/**
 * Type helper for Alarm Entity
 */
export type AlarmEntity = typeof AlarmEntity

// =============================================================================
// Handler Implementation (REFACTORED - delegates to Machine)
// =============================================================================

/**
 * AlarmEntity handler layer
 *
 * ARCHITECTURE (Machine + Entity):
 * - Boots AlarmMachine at initialization
 * - Handlers delegate to Machine via actor.send()
 * - Machine validates state transitions via ISA-18.2 graph
 * - StateService wrapped by Machine procedures
 *
 * Usage:
 * ```typescript
 * // Testing: In-memory adapters
 * const TestStack = AlarmEntityHandlers.pipe(
 *   Layer.provide(AllStateServicesInMemory),
 *   Layer.provide(IIoTFeatureFlagsDisabledLayer)
 * )
 * ```
 */
export const AlarmEntityHandlers = AlarmEntity.toLayer(
  Effect.gen(function* () {
    // ─────────────────────────────────────────────────────────────────────────
    // PORT INJECTION
    // ─────────────────────────────────────────────────────────────────────────
    const state = yield* AlarmState          // Port: state persistence
    const flags = yield* IIoTFeatureFlags    // Port: feature flags

    // ─────────────────────────────────────────────────────────────────────────
    // MACHINE BOOT (internal actor)
    // ─────────────────────────────────────────────────────────────────────────
    const alarmMachine = makeAlarmMachine({ state, flags })
    const actor = yield* Machine.boot(alarmMachine)

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLERS DELEGATE TO MACHINE
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create handler - delegates to InternalCreateAlarm procedure
     */
    const handleCreate = (envelope: {
      payload: {
        deviceId: string
        assetId?: string
        alarmType: string
        severity: string
        message?: string
        metadata?: Record<string, unknown>
      }
    }) =>
      actor.send(new InternalCreateAlarm({ params: envelope.payload as typeof CreateAlarmParams.Type })).pipe(
        Effect.catchTag('MachineCreateError', (e) =>
          Effect.fail(new RpcQueryError({ operation: 'create', message: e.message }))
        )
      )

    /**
     * Get handler - delegates to InternalGetAlarm procedure
     */
    const handleGet = (envelope: { payload: { alarmId: AlarmId } }) =>
      actor.send(new InternalGetAlarm({ alarmId: envelope.payload.alarmId })).pipe(
        Effect.catchTag('MachineAlarmNotFoundError', (e) =>
          Effect.fail(new RpcAlarmNotFoundError({ alarmId: e.alarmId as AlarmId }))
        ),
        Effect.tapError((e) =>
          Effect.logWarning(`Get: ${e._tag} for alarm ${envelope.payload.alarmId}`)
        )
      )

    /**
     * Acknowledge handler - delegates to InternalAcknowledgeAlarm procedure
     * Maps Machine errors to appropriate RPC errors
     */
    const handleAcknowledge = (envelope: { payload: { alarmId: AlarmId; acknowledgedBy: string } }) =>
      actor.send(
        new InternalAcknowledgeAlarm({
          alarmId: envelope.payload.alarmId,
          acknowledgedBy: envelope.payload.acknowledgedBy,
        })
      ).pipe(
        Effect.catchTags({
          MachineAlarmNotFoundError: (e) =>
            Effect.fail(new RpcAlarmNotFoundError({ alarmId: e.alarmId as AlarmId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcAlarmAlreadyAcknowledgedError({ alarmId: e.alarmId as AlarmId })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Acknowledge: ${e._tag} for alarm ${envelope.payload.alarmId}`)
        )
      )

    /**
     * Clear handler - delegates to InternalClearAlarm procedure
     * Maps Machine errors to appropriate RPC errors
     */
    const handleClear = (envelope: { payload: { alarmId: AlarmId } }) =>
      actor.send(new InternalClearAlarm({ alarmId: envelope.payload.alarmId })).pipe(
        Effect.catchTags({
          MachineAlarmNotFoundError: (e) =>
            Effect.fail(new RpcAlarmNotFoundError({ alarmId: e.alarmId as AlarmId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcAlarmAlreadyClearedError({ alarmId: e.alarmId as AlarmId })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Clear: ${e._tag} for alarm ${envelope.payload.alarmId}`)
        )
      )

    return AlarmEntity.of({
      [AlarmCreateTag]: handleCreate,
      [AlarmGetTag]: handleGet,
      [AlarmAcknowledgeTag]: handleAcknowledge,
      [AlarmClearTag]: handleClear,
    })
  })
)
