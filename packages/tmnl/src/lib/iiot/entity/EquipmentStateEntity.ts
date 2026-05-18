/**
 * EquipmentStateEntity - Effect Cluster Entity for Equipment State & OEE
 *
 * Manages ISA-95/OEE equipment states for availability tracking.
 * Equipment states are EVENT SOURCED for accurate OEE calculations.
 *
 * ARCHITECTURE (Machine + Entity):
 * - External API: Rpc.make() definitions (PRESERVED)
 * - Internal: Machine booted at handler init, delegates via actor.send()
 * - Graph validation: ISA-95/OEE state transitions validated in Machine
 * - StateService: Wrapped by Machine procedures
 *
 * State Types (ISA-95 / OEE):
 * - running: Producing good parts (productive time)
 * - idle: Available but not producing (performance loss)
 * - planned_downtime: Scheduled stops (availability loss)
 * - unplanned_downtime: Breakdowns (availability loss)
 * - setup: Changeover time (performance loss)
 * - blocked: Starved/blocked (performance loss)
 *
 * OEE = Availability × Performance × Quality
 *
 * @module
 */

import { Schema, Effect, Option, DateTime } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import { SqlClient } from '@effect/sql'
import { MachineId } from '../schemas/identifiers'
import {
  EquipmentStateId,
  EquipmentState,
  StateType,
  StateReason,
  StateDurationAggregate,
} from '../schemas/equipment-state/schema'
import { EquipmentStateService } from '../state'
import { IIoTFeatureFlags } from '../infrastructure/feature-flags'
import { DomainEventEmitter } from '../services/events'
import { EquipmentStateTransitionRepo } from '../repos'
import {
  makeEquipmentStateMachine,
  InternalGetCurrent,
  InternalGetHistory,
  InternalTransition,
  InternalUpdateReason,
  InternalGetOee,
  InternalGetDurations,
} from '../machines/EquipmentStateMachine'

// =============================================================================
// RPC Error Schemas
// =============================================================================

/** Equipment state not found error */
export class RpcEquipmentStateNotFoundError extends Schema.TaggedError<RpcEquipmentStateNotFoundError>()(
  'RpcEquipmentStateNotFoundError',
  {
    stateId: EquipmentStateId,
  }
) {}

/** Machine not found error */
export class RpcMachineStateNotFoundError extends Schema.TaggedError<RpcMachineStateNotFoundError>()(
  'RpcMachineStateNotFoundError',
  {
    machineId: MachineId,
  }
) {}

/** Invalid state transition error */
export class RpcEquipmentTransitionError extends Schema.TaggedError<RpcEquipmentTransitionError>()(
  'RpcEquipmentTransitionError',
  {
    machineId: MachineId,
    currentState: StateType,
    targetState: StateType,
    message: Schema.String,
  }
) {}

/** OEE calculation error */
export class RpcOeeCalculationError extends Schema.TaggedError<RpcOeeCalculationError>()(
  'RpcOeeCalculationError',
  {
    machineId: MachineId,
    message: Schema.String,
  }
) {}

// =============================================================================
// OEE Result Schema
// =============================================================================

/** OEE calculation result */
export const OeeResult = Schema.Struct({
  machineId: MachineId,
  periodStart: Schema.DateTimeUtc,
  periodEnd: Schema.DateTimeUtc,
  /** Availability (0-1): Running / (Running + Unplanned Downtime) */
  availability: Schema.Number,
  /** Performance (0-1): Actual output / Theoretical output */
  performance: Schema.Number,
  /** Quality (0-1): Good parts / Total parts */
  quality: Schema.Number,
  /** OEE (0-1): Availability × Performance × Quality */
  oee: Schema.Number,
  /** Breakdown by state type (milliseconds) */
  breakdown: StateDurationAggregate,
})
export type OeeResult = Schema.Schema.Type<typeof OeeResult>

// =============================================================================
// RPC Tags
// =============================================================================

export const EquipmentStateEntityType = 'EquipmentState' as const
export const EquipmentStateGetCurrentTag = `${EquipmentStateEntityType}.GetCurrent` as const
export const EquipmentStateGetHistoryTag = `${EquipmentStateEntityType}.GetHistory` as const
export const EquipmentStateTransitionTag = `${EquipmentStateEntityType}.Transition` as const
export const EquipmentStateUpdateReasonTag = `${EquipmentStateEntityType}.UpdateReason` as const
export const EquipmentStateGetOeeTag = `${EquipmentStateEntityType}.GetOee` as const
export const EquipmentStateGetDurationsTag = `${EquipmentStateEntityType}.GetDurations` as const

// =============================================================================
// RPC Definitions
// =============================================================================

/**
 * Get current equipment state for a machine
 */
export class GetCurrentStateRpc extends Rpc.make(EquipmentStateGetCurrentTag, {
  payload: Schema.Struct({
    machineId: MachineId,
  }),
  primaryKey: ({ machineId }) => machineId,
  success: EquipmentState,
  error: RpcMachineStateNotFoundError,
}) {}

/**
 * Get equipment state history for a machine
 */
export class GetStateHistoryRpc extends Rpc.make(EquipmentStateGetHistoryTag, {
  payload: Schema.Struct({
    machineId: MachineId,
    since: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
    until: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
    limit: Schema.optionalWith(Schema.Number, { default: () => 100 }),
  }),
  primaryKey: ({ machineId }) => machineId,
  success: Schema.Array(EquipmentState),
  error: RpcMachineStateNotFoundError,
}) {}

/**
 * Transition machine to a new state
 */
export class TransitionStateRpc extends Rpc.make(EquipmentStateTransitionTag, {
  payload: Schema.Struct({
    machineId: MachineId,
    newState: StateType,
    reason: Schema.optionalWith(StateReason, { as: 'Option' }),
    operatorId: Schema.optionalWith(Schema.String, { as: 'Option' }),
    notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
  }),
  primaryKey: ({ machineId }) => machineId,
  success: EquipmentState,
  error: Schema.Union(RpcMachineStateNotFoundError, RpcEquipmentTransitionError),
}) {}

/**
 * Update reason for current state
 */
export class UpdateStateReasonRpc extends Rpc.make(EquipmentStateUpdateReasonTag, {
  payload: Schema.Struct({
    stateId: EquipmentStateId,
    reason: StateReason,
    notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
  }),
  primaryKey: ({ stateId }) => stateId,
  success: EquipmentState,
  error: RpcEquipmentStateNotFoundError,
}) {}

/**
 * Calculate OEE for a machine over a time period
 */
export class GetOeeRpc extends Rpc.make(EquipmentStateGetOeeTag, {
  payload: Schema.Struct({
    machineId: MachineId,
    since: Schema.DateTimeUtc,
    until: Schema.DateTimeUtc,
    /** Optional: Theoretical output per hour for performance calculation */
    theoreticalOutputPerHour: Schema.optionalWith(Schema.Number, { as: 'Option' }),
    /** Optional: Actual good parts produced (for quality calculation) */
    goodPartsProduced: Schema.optionalWith(Schema.Number, { as: 'Option' }),
    /** Optional: Total parts produced (for quality calculation) */
    totalPartsProduced: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  }),
  primaryKey: ({ machineId }) => machineId,
  success: OeeResult,
  error: Schema.Union(RpcMachineStateNotFoundError, RpcOeeCalculationError),
}) {}

/**
 * Get state durations aggregated by type
 */
export class GetDurationsRpc extends Rpc.make(EquipmentStateGetDurationsTag, {
  payload: Schema.Struct({
    machineId: MachineId,
    since: Schema.DateTimeUtc,
    until: Schema.DateTimeUtc,
  }),
  primaryKey: ({ machineId }) => machineId,
  success: StateDurationAggregate,
  error: RpcMachineStateNotFoundError,
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

/**
 * EquipmentState Entity
 *
 * Distributed actor managing equipment state for OEE tracking.
 * Each machine has its own entity instance keyed by machineId.
 *
 * Equipment states are EVENT SOURCED for accurate duration tracking
 * and temporal OEE calculations.
 */
export const EquipmentStateEntity = Entity.make(EquipmentStateEntityType, [
  GetCurrentStateRpc,
  GetStateHistoryRpc,
  TransitionStateRpc,
  UpdateStateReasonRpc,
  GetOeeRpc,
  GetDurationsRpc,
])

/**
 * Type helper for EquipmentState Entity
 */
export type EquipmentStateEntity = typeof EquipmentStateEntity

// =============================================================================
// Handler Implementation
// =============================================================================

/**
 * EquipmentStateEntity handler layer
 *
 * ARCHITECTURE (Machine + Entity):
 * - Boots Machine at handler initialization
 * - Delegates all operations via actor.send(InternalRequest)
 * - Maps Machine errors to RPC errors
 *
 * HEXAGONAL ARCHITECTURE (Ports & Adapters):
 * - Depends on EquipmentStateService PORT for state persistence
 * - Depends on IIoTFeatureFlags PORT for event emission control
 *
 * Usage:
 * ```typescript
 * // Testing: In-memory adapters
 * const TestStack = EquipmentStateEntityHandlers.pipe(
 *   Layer.provide(AllStateServicesInMemory),
 *   Layer.provide(IIoTFeatureFlagsDisabledLayer)
 * )
 * ```
 */
export const EquipmentStateEntityHandlers = EquipmentStateEntity.toLayer(
  Effect.gen(function* () {
    // ─────────────────────────────────────────────────────────────────────────
    // PORT INJECTION
    // ─────────────────────────────────────────────────────────────────────────
    const state = yield* EquipmentStateService    // Port: state persistence
    const flags = yield* IIoTFeatureFlags         // Port: feature flags
    const eventEmitter = yield* Effect.serviceOption(DomainEventEmitter)
    const sql = yield* Effect.serviceOption(SqlClient.SqlClient)
    const transitionRepo = yield* Effect.serviceOption(EquipmentStateTransitionRepo)

    // ─────────────────────────────────────────────────────────────────────────
    // MACHINE BOOT (Actor initialization)
    // ─────────────────────────────────────────────────────────────────────────
    const equipmentStateMachine = makeEquipmentStateMachine({
      state,
      flags,
      eventEmitter: Option.getOrUndefined(eventEmitter),
      sql: Option.getOrUndefined(sql),
      transitionRepo: Option.getOrUndefined(transitionRepo),
    })
    const actor = yield* Machine.boot(equipmentStateMachine)

    // ─────────────────────────────────────────────────────────────────────────
    // GetCurrent (delegates to Machine)
    // ─────────────────────────────────────────────────────────────────────────
    const handleGetCurrent = (envelope: { payload: { machineId: MachineId } }) =>
      actor.send(new InternalGetCurrent({ machineId: envelope.payload.machineId as string })).pipe(
        Effect.catchTag('MachineMachineStateNotFoundError', (e) =>
          Effect.fail(new RpcMachineStateNotFoundError({ machineId: e.machineId as MachineId }))
        )
      )

    // ─────────────────────────────────────────────────────────────────────────
    // GetHistory (delegates to Machine)
    // ─────────────────────────────────────────────────────────────────────────
    const handleGetHistory = (envelope: {
      payload: {
        machineId: MachineId
        since: Option.Option<DateTime.Utc>
        until: Option.Option<DateTime.Utc>
        limit: number
      }
    }) =>
      actor.send(new InternalGetHistory({
        machineId: envelope.payload.machineId as string,
        since: envelope.payload.since,
        until: envelope.payload.until,
        limit: envelope.payload.limit,
      })).pipe(
        Effect.catchTag('MachineMachineStateNotFoundError', (e) =>
          Effect.fail(new RpcMachineStateNotFoundError({ machineId: e.machineId as MachineId }))
        )
      )

    // ─────────────────────────────────────────────────────────────────────────
    // Transition (delegates to Machine with graph validation)
    // ─────────────────────────────────────────────────────────────────────────
    const handleTransition = (envelope: {
      payload: {
        machineId: MachineId
        newState: StateType
        reason: Option.Option<StateReason>
        operatorId: Option.Option<string>
        notes: Option.Option<string>
      }
    }) =>
      actor.send(new InternalTransition({
        machineId: envelope.payload.machineId as string,
        newState: envelope.payload.newState,
        reason: envelope.payload.reason,
        operatorId: envelope.payload.operatorId,
        notes: envelope.payload.notes,
      })).pipe(
        Effect.catchTags({
          MachineMachineStateNotFoundError: (e) =>
            Effect.fail(new RpcMachineStateNotFoundError({ machineId: e.machineId as MachineId })),
          MachineEquipmentTransitionError: (e) =>
            Effect.fail(new RpcEquipmentTransitionError({
              machineId: e.machineId as MachineId,
              currentState: e.fromState as StateType,
              targetState: e.toState as StateType,
              message: e.message,
            })),
        })
      )

    // ─────────────────────────────────────────────────────────────────────────
    // UpdateReason (delegates to Machine)
    // ─────────────────────────────────────────────────────────────────────────
    const handleUpdateReason = (envelope: {
      payload: {
        stateId: EquipmentStateId
        reason: StateReason
        notes: Option.Option<string>
      }
    }) =>
      actor.send(new InternalUpdateReason({
        stateId: envelope.payload.stateId,
        reason: envelope.payload.reason,
        notes: envelope.payload.notes,
      })).pipe(
        Effect.catchTag('MachineEquipmentStateNotFoundError', (e) =>
          Effect.fail(new RpcEquipmentStateNotFoundError({ stateId: e.stateId as EquipmentStateId }))
        )
      )

    // ─────────────────────────────────────────────────────────────────────────
    // GetOee (delegates to Machine)
    // ─────────────────────────────────────────────────────────────────────────
    const handleGetOee = (envelope: {
      payload: {
        machineId: MachineId
        since: DateTime.Utc
        until: DateTime.Utc
        theoreticalOutputPerHour: Option.Option<number>
        goodPartsProduced: Option.Option<number>
        totalPartsProduced: Option.Option<number>
      }
    }) =>
      actor.send(new InternalGetOee({
        machineId: envelope.payload.machineId as string,
        since: envelope.payload.since,
        until: envelope.payload.until,
        theoreticalOutputPerHour: envelope.payload.theoreticalOutputPerHour,
        goodPartsProduced: envelope.payload.goodPartsProduced,
        totalPartsProduced: envelope.payload.totalPartsProduced,
      })).pipe(
        Effect.catchTags({
          MachineMachineStateNotFoundError: (e) =>
            Effect.fail(new RpcMachineStateNotFoundError({ machineId: e.machineId as MachineId })),
          MachineOeeCalculationError: (e) =>
            Effect.fail(new RpcOeeCalculationError({
              machineId: e.machineId as MachineId,
              message: e.message,
            })),
        })
      )

    // ─────────────────────────────────────────────────────────────────────────
    // GetDurations (delegates to Machine)
    // ─────────────────────────────────────────────────────────────────────────
    const handleGetDurations = (envelope: {
      payload: {
        machineId: MachineId
        since: DateTime.Utc
        until: DateTime.Utc
      }
    }) =>
      actor.send(new InternalGetDurations({
        machineId: envelope.payload.machineId as string,
        since: envelope.payload.since,
        until: envelope.payload.until,
      })).pipe(
        Effect.catchTag('MachineMachineStateNotFoundError', (e) =>
          Effect.fail(new RpcMachineStateNotFoundError({ machineId: e.machineId as MachineId }))
        )
      )

    return EquipmentStateEntity.of({
      [EquipmentStateGetCurrentTag]: handleGetCurrent,
      [EquipmentStateGetHistoryTag]: handleGetHistory,
      [EquipmentStateTransitionTag]: handleTransition,
      [EquipmentStateUpdateReasonTag]: handleUpdateReason,
      [EquipmentStateGetOeeTag]: handleGetOee,
      [EquipmentStateGetDurationsTag]: handleGetDurations,
    })
  })
)
