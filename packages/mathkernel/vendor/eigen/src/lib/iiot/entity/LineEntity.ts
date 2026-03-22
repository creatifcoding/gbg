/**
 * LineEntity - Effect Cluster Entity for Production Line Lifecycle
 *
 * Manages ISA-95 compliant production line lifecycle with state machine transitions.
 *
 * ARCHITECTURE (Machine + Entity):
 * - External API: Rpc.make() definitions
 * - Internal: Machine booted at handler init, delegates via actor.send()
 * - Graph validation: ISA-95 state transitions validated in Machine
 * - StateService: Wrapped by Machine procedures
 *
 * Entity Lifecycle:
 * - Create: Initialize line with entity-scoped state
 * - Get: Read current line state
 * - Start: idle -> running
 * - Stop: running -> idle
 * - BeginChangeover: running -> changeover
 * - CompleteChangeover: changeover -> running
 * - MarkStarved: running -> starved
 * - ClearStarved: starved -> running
 * - MarkBlocked: running -> blocked
 * - ClearBlocked: blocked -> running
 * - EnterMaintenance: idle|running -> maintenance
 * - CompleteMaintenance: maintenance -> idle
 * - Decommission: idle|maintenance -> decommissioned
 *
 * @module
 */

import { Schema, Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import { Line, CreateLineParams } from '../schemas/assets/line'
import { LineId } from '../schemas/identifiers'
import { LineState } from '../state'
import { IIoTFeatureFlags } from '../infrastructure/feature-flags'
import {
  makeLineMachine,
  InternalCreateLine,
  InternalGetLine,
  InternalStart,
  InternalStop,
  InternalBeginChangeover,
  InternalCompleteChangeover,
  InternalMarkStarved,
  InternalClearStarved,
  InternalMarkBlocked,
  InternalClearBlocked,
  InternalEnterMaintenance,
  InternalCompleteMaintenance,
  InternalDecommissionLine,
} from '../machines/LineMachine'

// =============================================================================
// RPC Error Schemas
// =============================================================================

/** Line not found error */
export class RpcLineNotFoundError extends Schema.TaggedError<RpcLineNotFoundError>()(
  'RpcLineNotFoundError',
  {
    lineId: LineId,
  }
) {}

/** Line transition error (invalid state transition) */
export class RpcLineTransitionError extends Schema.TaggedError<RpcLineTransitionError>()(
  'RpcLineTransitionError',
  {
    lineId: LineId,
    message: Schema.String,
  }
) {}

/** Line query error */
export class RpcLineQueryError extends Schema.TaggedError<RpcLineQueryError>()(
  'RpcLineQueryError',
  {
    operation: Schema.String,
    message: Schema.String,
  }
) {}

// =============================================================================
// RPC Tags
// =============================================================================

export const LineEntityType = 'Line' as const
export const LineCreateTag = `${LineEntityType}.Create` as const
export const LineGetTag = `${LineEntityType}.Get` as const
export const LineStartTag = `${LineEntityType}.Start` as const
export const LineStopTag = `${LineEntityType}.Stop` as const
export const LineBeginChangeoverTag = `${LineEntityType}.BeginChangeover` as const
export const LineCompleteChangeoverTag = `${LineEntityType}.CompleteChangeover` as const
export const LineMarkStarvedTag = `${LineEntityType}.MarkStarved` as const
export const LineClearStarvedTag = `${LineEntityType}.ClearStarved` as const
export const LineMarkBlockedTag = `${LineEntityType}.MarkBlocked` as const
export const LineClearBlockedTag = `${LineEntityType}.ClearBlocked` as const
export const LineEnterMaintenanceTag = `${LineEntityType}.EnterMaintenance` as const
export const LineCompleteMaintenanceTag = `${LineEntityType}.CompleteMaintenance` as const
export const LineDecommissionTag = `${LineEntityType}.Decommission` as const

// =============================================================================
// RPC Definitions
// =============================================================================

/** Create a new line */
export class CreateLineRpc extends Rpc.make(LineCreateTag, {
  payload: CreateLineParams,
  primaryKey: ({ slug }) => slug,
  success: Line,
  error: RpcLineQueryError,
}) {}

/** Get line by ID */
export class GetLineRpc extends Rpc.make(LineGetTag, {
  payload: Schema.Struct({ lineId: LineId }),
  primaryKey: ({ lineId }) => lineId,
  success: Line,
  error: RpcLineNotFoundError,
}) {}

/** Start line */
export class StartLineRpc extends Rpc.make(LineStartTag, {
  payload: Schema.Struct({ lineId: LineId }),
  primaryKey: ({ lineId }) => lineId,
  success: Line,
  error: Schema.Union(RpcLineNotFoundError, RpcLineTransitionError),
}) {}

/** Stop line */
export class StopLineRpc extends Rpc.make(LineStopTag, {
  payload: Schema.Struct({ lineId: LineId }),
  primaryKey: ({ lineId }) => lineId,
  success: Line,
  error: Schema.Union(RpcLineNotFoundError, RpcLineTransitionError),
}) {}

/** Begin changeover */
export class BeginChangeoverRpc extends Rpc.make(LineBeginChangeoverTag, {
  payload: Schema.Struct({ lineId: LineId }),
  primaryKey: ({ lineId }) => lineId,
  success: Line,
  error: Schema.Union(RpcLineNotFoundError, RpcLineTransitionError),
}) {}

/** Complete changeover */
export class CompleteChangeoverRpc extends Rpc.make(LineCompleteChangeoverTag, {
  payload: Schema.Struct({ lineId: LineId }),
  primaryKey: ({ lineId }) => lineId,
  success: Line,
  error: Schema.Union(RpcLineNotFoundError, RpcLineTransitionError),
}) {}

/** Mark starved */
export class MarkStarvedRpc extends Rpc.make(LineMarkStarvedTag, {
  payload: Schema.Struct({ lineId: LineId }),
  primaryKey: ({ lineId }) => lineId,
  success: Line,
  error: Schema.Union(RpcLineNotFoundError, RpcLineTransitionError),
}) {}

/** Clear starved */
export class ClearStarvedRpc extends Rpc.make(LineClearStarvedTag, {
  payload: Schema.Struct({ lineId: LineId }),
  primaryKey: ({ lineId }) => lineId,
  success: Line,
  error: Schema.Union(RpcLineNotFoundError, RpcLineTransitionError),
}) {}

/** Mark blocked */
export class MarkBlockedRpc extends Rpc.make(LineMarkBlockedTag, {
  payload: Schema.Struct({ lineId: LineId }),
  primaryKey: ({ lineId }) => lineId,
  success: Line,
  error: Schema.Union(RpcLineNotFoundError, RpcLineTransitionError),
}) {}

/** Clear blocked */
export class ClearBlockedRpc extends Rpc.make(LineClearBlockedTag, {
  payload: Schema.Struct({ lineId: LineId }),
  primaryKey: ({ lineId }) => lineId,
  success: Line,
  error: Schema.Union(RpcLineNotFoundError, RpcLineTransitionError),
}) {}

/** Enter maintenance */
export class EnterMaintenanceRpc extends Rpc.make(LineEnterMaintenanceTag, {
  payload: Schema.Struct({ lineId: LineId }),
  primaryKey: ({ lineId }) => lineId,
  success: Line,
  error: Schema.Union(RpcLineNotFoundError, RpcLineTransitionError),
}) {}

/** Complete maintenance */
export class CompleteMaintenanceRpc extends Rpc.make(LineCompleteMaintenanceTag, {
  payload: Schema.Struct({ lineId: LineId }),
  primaryKey: ({ lineId }) => lineId,
  success: Line,
  error: Schema.Union(RpcLineNotFoundError, RpcLineTransitionError),
}) {}

/** Decommission line */
export class DecommissionLineRpc extends Rpc.make(LineDecommissionTag, {
  payload: Schema.Struct({ lineId: LineId }),
  primaryKey: ({ lineId }) => lineId,
  success: Line,
  error: Schema.Union(RpcLineNotFoundError, RpcLineTransitionError),
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

/**
 * Line Entity
 *
 * Distributed actor managing production line lifecycle state.
 * Each line instance is keyed by lineId and maintains
 * entity-scoped state via Effect.Ref.
 */
export const LineEntity = Entity.make(LineEntityType, [
  CreateLineRpc,
  GetLineRpc,
  StartLineRpc,
  StopLineRpc,
  BeginChangeoverRpc,
  CompleteChangeoverRpc,
  MarkStarvedRpc,
  ClearStarvedRpc,
  MarkBlockedRpc,
  ClearBlockedRpc,
  EnterMaintenanceRpc,
  CompleteMaintenanceRpc,
  DecommissionLineRpc,
])

/** Type helper for Line Entity */
export type LineEntity = typeof LineEntity

// =============================================================================
// Handler Implementation (delegates to Machine)
// =============================================================================

/**
 * Helper to create a transition handler that delegates to the Machine.
 * All transition handlers follow the same pattern: send request, map errors.
 */
const makeTransitionHandler = <R extends { lineId: string }>(
  actor: Awaited<ReturnType<typeof Machine.boot<ReturnType<typeof makeLineMachine>>>>,
  InternalRequest: new (args: { lineId: string }) => R,
) => (envelope: { payload: { lineId: LineId } }) =>
    actor.send(new InternalRequest({ lineId: envelope.payload.lineId }) as any).pipe(
      Effect.catchTags({
        MachineLineNotFoundError: (e: { entityId: string }) =>
          Effect.fail(new RpcLineNotFoundError({ lineId: e.entityId as LineId })),
        MachineLineInvalidTransitionError: (e: { entityId: string; message: string }) =>
          Effect.fail(new RpcLineTransitionError({ lineId: e.entityId as LineId, message: e.message })),
      }),
      Effect.tapError((e: { _tag: string }) =>
        Effect.logWarning(`Transition: ${e._tag} for line ${envelope.payload.lineId}`)
      )
    )

/**
 * LineEntity handler layer
 *
 * ARCHITECTURE (Machine + Entity):
 * - Boots LineMachine at initialization
 * - Handlers delegate to Machine via actor.send()
 * - Machine validates state transitions via ISA-95 graph
 * - StateService wrapped by Machine procedures
 */
export const LineEntityHandlers = LineEntity.toLayer(
  Effect.gen(function* () {
    // ─────────────────────────────────────────────────────────────────────────
    // PORT INJECTION
    // ─────────────────────────────────────────────────────────────────────────
    const state = yield* LineState
    const flags = yield* IIoTFeatureFlags

    // ─────────────────────────────────────────────────────────────────────────
    // MACHINE BOOT (internal actor)
    // ─────────────────────────────────────────────────────────────────────────
    const lineMachine = makeLineMachine({ state, flags })
    const actor = yield* Machine.boot(lineMachine)

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLERS DELEGATE TO MACHINE
    // ─────────────────────────────────────────────────────────────────────────

    const handleCreate = (envelope: { payload: typeof CreateLineParams.Type }) =>
      actor.send(new InternalCreateLine({ params: envelope.payload })).pipe(
        Effect.catchTag('MachineLineCreateError', (e) =>
          Effect.fail(new RpcLineQueryError({ operation: 'create', message: e.message }))
        )
      )

    const handleGet = (envelope: { payload: { lineId: LineId } }) =>
      actor.send(new InternalGetLine({ lineId: envelope.payload.lineId })).pipe(
        Effect.catchTag('MachineLineNotFoundError', (e) =>
          Effect.fail(new RpcLineNotFoundError({ lineId: e.entityId as LineId }))
        ),
        Effect.tapError((e) =>
          Effect.logWarning(`Get: ${e._tag} for line ${envelope.payload.lineId}`)
        )
      )

    const handleStart = (envelope: { payload: { lineId: LineId } }) =>
      actor.send(new InternalStart({ lineId: envelope.payload.lineId })).pipe(
        Effect.catchTags({
          MachineLineNotFoundError: (e) =>
            Effect.fail(new RpcLineNotFoundError({ lineId: e.entityId as LineId })),
          MachineLineInvalidTransitionError: (e) =>
            Effect.fail(new RpcLineTransitionError({ lineId: e.entityId as LineId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Start: ${e._tag} for line ${envelope.payload.lineId}`)
        )
      )

    const handleStop = (envelope: { payload: { lineId: LineId } }) =>
      actor.send(new InternalStop({ lineId: envelope.payload.lineId })).pipe(
        Effect.catchTags({
          MachineLineNotFoundError: (e) =>
            Effect.fail(new RpcLineNotFoundError({ lineId: e.entityId as LineId })),
          MachineLineInvalidTransitionError: (e) =>
            Effect.fail(new RpcLineTransitionError({ lineId: e.entityId as LineId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Stop: ${e._tag} for line ${envelope.payload.lineId}`)
        )
      )

    const handleBeginChangeover = (envelope: { payload: { lineId: LineId } }) =>
      actor.send(new InternalBeginChangeover({ lineId: envelope.payload.lineId })).pipe(
        Effect.catchTags({
          MachineLineNotFoundError: (e) =>
            Effect.fail(new RpcLineNotFoundError({ lineId: e.entityId as LineId })),
          MachineLineInvalidTransitionError: (e) =>
            Effect.fail(new RpcLineTransitionError({ lineId: e.entityId as LineId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`BeginChangeover: ${e._tag} for line ${envelope.payload.lineId}`)
        )
      )

    const handleCompleteChangeover = (envelope: { payload: { lineId: LineId } }) =>
      actor.send(new InternalCompleteChangeover({ lineId: envelope.payload.lineId })).pipe(
        Effect.catchTags({
          MachineLineNotFoundError: (e) =>
            Effect.fail(new RpcLineNotFoundError({ lineId: e.entityId as LineId })),
          MachineLineInvalidTransitionError: (e) =>
            Effect.fail(new RpcLineTransitionError({ lineId: e.entityId as LineId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`CompleteChangeover: ${e._tag} for line ${envelope.payload.lineId}`)
        )
      )

    const handleMarkStarved = (envelope: { payload: { lineId: LineId } }) =>
      actor.send(new InternalMarkStarved({ lineId: envelope.payload.lineId })).pipe(
        Effect.catchTags({
          MachineLineNotFoundError: (e) =>
            Effect.fail(new RpcLineNotFoundError({ lineId: e.entityId as LineId })),
          MachineLineInvalidTransitionError: (e) =>
            Effect.fail(new RpcLineTransitionError({ lineId: e.entityId as LineId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`MarkStarved: ${e._tag} for line ${envelope.payload.lineId}`)
        )
      )

    const handleClearStarved = (envelope: { payload: { lineId: LineId } }) =>
      actor.send(new InternalClearStarved({ lineId: envelope.payload.lineId })).pipe(
        Effect.catchTags({
          MachineLineNotFoundError: (e) =>
            Effect.fail(new RpcLineNotFoundError({ lineId: e.entityId as LineId })),
          MachineLineInvalidTransitionError: (e) =>
            Effect.fail(new RpcLineTransitionError({ lineId: e.entityId as LineId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`ClearStarved: ${e._tag} for line ${envelope.payload.lineId}`)
        )
      )

    const handleMarkBlocked = (envelope: { payload: { lineId: LineId } }) =>
      actor.send(new InternalMarkBlocked({ lineId: envelope.payload.lineId })).pipe(
        Effect.catchTags({
          MachineLineNotFoundError: (e) =>
            Effect.fail(new RpcLineNotFoundError({ lineId: e.entityId as LineId })),
          MachineLineInvalidTransitionError: (e) =>
            Effect.fail(new RpcLineTransitionError({ lineId: e.entityId as LineId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`MarkBlocked: ${e._tag} for line ${envelope.payload.lineId}`)
        )
      )

    const handleClearBlocked = (envelope: { payload: { lineId: LineId } }) =>
      actor.send(new InternalClearBlocked({ lineId: envelope.payload.lineId })).pipe(
        Effect.catchTags({
          MachineLineNotFoundError: (e) =>
            Effect.fail(new RpcLineNotFoundError({ lineId: e.entityId as LineId })),
          MachineLineInvalidTransitionError: (e) =>
            Effect.fail(new RpcLineTransitionError({ lineId: e.entityId as LineId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`ClearBlocked: ${e._tag} for line ${envelope.payload.lineId}`)
        )
      )

    const handleEnterMaintenance = (envelope: { payload: { lineId: LineId } }) =>
      actor.send(new InternalEnterMaintenance({ lineId: envelope.payload.lineId })).pipe(
        Effect.catchTags({
          MachineLineNotFoundError: (e) =>
            Effect.fail(new RpcLineNotFoundError({ lineId: e.entityId as LineId })),
          MachineLineInvalidTransitionError: (e) =>
            Effect.fail(new RpcLineTransitionError({ lineId: e.entityId as LineId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`EnterMaintenance: ${e._tag} for line ${envelope.payload.lineId}`)
        )
      )

    const handleCompleteMaintenance = (envelope: { payload: { lineId: LineId } }) =>
      actor.send(new InternalCompleteMaintenance({ lineId: envelope.payload.lineId })).pipe(
        Effect.catchTags({
          MachineLineNotFoundError: (e) =>
            Effect.fail(new RpcLineNotFoundError({ lineId: e.entityId as LineId })),
          MachineLineInvalidTransitionError: (e) =>
            Effect.fail(new RpcLineTransitionError({ lineId: e.entityId as LineId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`CompleteMaintenance: ${e._tag} for line ${envelope.payload.lineId}`)
        )
      )

    const handleDecommission = (envelope: { payload: { lineId: LineId } }) =>
      actor.send(new InternalDecommissionLine({ lineId: envelope.payload.lineId })).pipe(
        Effect.catchTags({
          MachineLineNotFoundError: (e) =>
            Effect.fail(new RpcLineNotFoundError({ lineId: e.entityId as LineId })),
          MachineLineInvalidTransitionError: (e) =>
            Effect.fail(new RpcLineTransitionError({ lineId: e.entityId as LineId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Decommission: ${e._tag} for line ${envelope.payload.lineId}`)
        )
      )

    return LineEntity.of({
      [LineCreateTag]: handleCreate,
      [LineGetTag]: handleGet,
      [LineStartTag]: handleStart,
      [LineStopTag]: handleStop,
      [LineBeginChangeoverTag]: handleBeginChangeover,
      [LineCompleteChangeoverTag]: handleCompleteChangeover,
      [LineMarkStarvedTag]: handleMarkStarved,
      [LineClearStarvedTag]: handleClearStarved,
      [LineMarkBlockedTag]: handleMarkBlocked,
      [LineClearBlockedTag]: handleClearBlocked,
      [LineEnterMaintenanceTag]: handleEnterMaintenance,
      [LineCompleteMaintenanceTag]: handleCompleteMaintenance,
      [LineDecommissionTag]: handleDecommission,
    })
  })
)
