/**
 * RelationshipReactor — graph-backed consistency sidecar.
 *
 * Reactor is not a user-facing entity and not a workflow engine. It consumes
 * committed facts, queries relationship metadata, pre-filters target entities,
 * and dispatches typed commands to the owners of the affected state.
 *
 * v1 vertical slice:
 * - Machine enters maintenance/unavailable state
 * - graph query finds WorkOrders targeting that Machine
 * - only active WorkOrders are dispatched a suspend command
 * - terminal/ineligible WorkOrders are classified as skips, not noisy failures
 *
 * @module
 */

import { Context, Effect, Layer, Option, Schema, Stream } from 'effect'
import * as EventJournal from '@effect/experimental/EventJournal'
import {
  MachineId,
  PropagationId,
  WorkOrderId,
  type MachineId as MachineIdType,
  type PropagationId as PropagationIdType,
  type WorkOrderId as WorkOrderIdType,
} from '../../schemas/identifiers'
import { WorkOrder, WorkOrderStatus } from '../../schemas/work-orders'
import { GraphClient } from '../l1/GraphClient'
import { WorkOrderState } from '../../state'
import { EquipmentStateChange, EventDistribution } from '../../realtime/event-distribution'
import { EquipmentStateEvents } from '../../schemas/events/groups'
import {
  ReactorCheckpointRepo,
  type ReactorCheckpointRepository,
} from '../../repos/ReactorCheckpointRepo'
import type { ReactorCheckpointOutcome } from '../../schemas/reactor'
import {
  WorkOrderEntity,
  WorkOrderSuspendTag,
} from '../../entity/WorkOrderEntity'

// =============================================================================
// Schemas
// =============================================================================

export class MachineMaintenanceFact extends Schema.TaggedClass<MachineMaintenanceFact>()('MachineMaintenanceFact', {
  machineId: MachineId,
  reason: Schema.optional(Schema.String),
  propagationId: Schema.optional(PropagationId),
}) {}

export const WorkOrderReactorSkipReason = Schema.Literal(
  'not_found',
  'terminal_state',
  'not_started',
  'already_suspended',
)
export type WorkOrderReactorSkipReason = typeof WorkOrderReactorSkipReason.Type

export class WorkOrderReactorDecision extends Schema.TaggedClass<WorkOrderReactorDecision>()('WorkOrderReactorDecision', {
  workOrderId: WorkOrderId,
  status: WorkOrderStatus,
  eligible: Schema.Boolean,
  skipReason: Schema.optional(WorkOrderReactorSkipReason),
}) {}

export class WorkOrderReactorPlan extends Schema.TaggedClass<WorkOrderReactorPlan>()('WorkOrderReactorPlan', {
  sourceMachineId: MachineId,
  reason: Schema.String,
  propagationId: Schema.optional(PropagationId),
  decisions: Schema.Array(WorkOrderReactorDecision),
}) {}

export const WorkOrderReactorDispatchOutcome = Schema.Literal(
  'suspended',
  'skipped',
  'failed',
)
export type WorkOrderReactorDispatchOutcome = typeof WorkOrderReactorDispatchOutcome.Type

export class WorkOrderReactorDispatchResult extends Schema.TaggedClass<WorkOrderReactorDispatchResult>()('WorkOrderReactorDispatchResult', {
  workOrderId: WorkOrderId,
  outcome: WorkOrderReactorDispatchOutcome,
  skipReason: Schema.optional(WorkOrderReactorSkipReason),
  error: Schema.optional(Schema.String),
}) {}

export class WorkOrderReactorRunResult extends Schema.TaggedClass<WorkOrderReactorRunResult>()('WorkOrderReactorRunResult', {
  plan: WorkOrderReactorPlan,
  results: Schema.Array(WorkOrderReactorDispatchResult),
}) {}

// =============================================================================
// Command Dispatch Port
// =============================================================================

export interface WorkOrderReactorDispatcherShape {
  readonly suspendForEquipmentUnavailable: (input: {
    readonly workOrderId: WorkOrderIdType
    readonly sourceMachineId: MachineIdType
    readonly propagationId?: PropagationIdType
  }) => Effect.Effect<WorkOrder, unknown>
}

export class WorkOrderReactorDispatcher extends Context.Tag('iiot/WorkOrderReactorDispatcher')<
  WorkOrderReactorDispatcher,
  WorkOrderReactorDispatcherShape
>() {}

/**
 * Production dispatcher: sends the typed suspend RPC to WorkOrderEntity.
 */
export const WorkOrderEntityReactorDispatcherLive = Layer.effect(
  WorkOrderReactorDispatcher,
  Effect.gen(function* () {
    const makeClient = yield* WorkOrderEntity.client

    return WorkOrderReactorDispatcher.of({
      suspendForEquipmentUnavailable: ({ workOrderId, sourceMachineId, propagationId }) => {
        const client = makeClient(workOrderId)
        return client[WorkOrderSuspendTag]({
          workOrderId,
          reason: 'equipment_unavailable',
          expectedResume: Option.none(),
          causedByPropagationId: propagationId ? Option.some(propagationId as PropagationIdType) : Option.none(),
          notes: Option.some(
            `Reactor: source machine ${sourceMachineId} unavailable${
              propagationId ? `; propagation=${propagationId}` : ''
            }`,
          ),
        })
      },
    })
  }),
)

// =============================================================================
// Reactor Service
// =============================================================================

export interface RelationshipReactorShape {
  readonly planMachineMaintenance: (
    fact: MachineMaintenanceFact,
  ) => Effect.Effect<WorkOrderReactorPlan, unknown>
  readonly reactToMachineMaintenance: (
    fact: MachineMaintenanceFact,
  ) => Effect.Effect<WorkOrderReactorRunResult, unknown>
  readonly reactToEquipmentStateChange: (
    change: EquipmentStateChange,
  ) => Effect.Effect<Option.Option<WorkOrderReactorRunResult>, unknown>
  readonly reactToJournalEntry: (
    entry: EventJournal.Entry,
  ) => Effect.Effect<Option.Option<WorkOrderReactorRunResult>, unknown>
  /** Drain the warm EquipmentState stream. Intended to be forked as a sidecar fiber. */
  readonly runEquipmentStateStream: Effect.Effect<void, unknown>
}

export class RelationshipReactor extends Context.Tag('iiot/RelationshipReactor')<
  RelationshipReactor,
  RelationshipReactorShape
>() {}

const terminalStatuses = new Set<WorkOrderStatus>([
  'rejected',
  'completed',
  'failed',
  'cancelled',
  'closed',
])

const unavailableEquipmentStates = new Set([
  'maintenance',
  'planned_downtime',
  'unplanned_downtime',
  'faulted',
  'offline',
])

const classifyWorkOrder = (workOrder: WorkOrder): WorkOrderReactorDecision => {
  if (workOrder.status === 'started' || workOrder.status === 'resumed') {
    return new WorkOrderReactorDecision({
      workOrderId: workOrder.id,
      status: workOrder.status,
      eligible: true,
    })
  }

  if (workOrder.status === 'suspended') {
    return new WorkOrderReactorDecision({
      workOrderId: workOrder.id,
      status: workOrder.status,
      eligible: false,
      skipReason: 'already_suspended',
    })
  }

  return new WorkOrderReactorDecision({
    workOrderId: workOrder.id,
    status: workOrder.status,
    eligible: false,
    skipReason: terminalStatuses.has(workOrder.status) ? 'terminal_state' : 'not_started',
  })
}

const notFoundDecision = (workOrderId: WorkOrderIdType): WorkOrderReactorDecision =>
  new WorkOrderReactorDecision({
    workOrderId,
    status: 'closed',
    eligible: false,
    skipReason: 'not_found',
  })

export const RelationshipReactorLive = Layer.effect(
  RelationshipReactor,
  Effect.gen(function* () {
    const graph = yield* GraphClient
    const workOrders = yield* WorkOrderState
    const dispatcher = yield* WorkOrderReactorDispatcher
    const distribution = yield* Effect.serviceOption(EventDistribution)
    const checkpoints = yield* Effect.serviceOption(ReactorCheckpointRepo)

    const planMachineMaintenance = (fact: MachineMaintenanceFact) =>
      Effect.gen(function* () {
        const ids = yield* graph.getWorkOrderIdsTargetingMachine(fact.machineId)

        const decisions = yield* Effect.forEach(
          ids,
          (workOrderId) =>
            workOrders.get(workOrderId).pipe(
              Effect.map(classifyWorkOrder),
              Effect.catchAll(() => Effect.succeed(notFoundDecision(workOrderId))),
            ),
          { concurrency: 'unbounded' },
        )

        return new WorkOrderReactorPlan({
          sourceMachineId: fact.machineId,
          reason: fact.reason ?? 'machine_unavailable',
          propagationId: fact.propagationId,
          decisions,
        })
      }).pipe(Effect.withSpan('iiot.reactor.planMachineMaintenance'))

    const reactToMachineMaintenance = (fact: MachineMaintenanceFact) =>
      Effect.gen(function* () {
        const plan = yield* planMachineMaintenance(fact)

        const results = yield* Effect.forEach(
          plan.decisions,
          (decision) => {
            if (!decision.eligible) {
              return Effect.succeed(new WorkOrderReactorDispatchResult({
                workOrderId: decision.workOrderId,
                outcome: 'skipped',
                skipReason: decision.skipReason,
              }))
            }

            return dispatcher.suspendForEquipmentUnavailable({
              workOrderId: decision.workOrderId,
              sourceMachineId: fact.machineId,
              propagationId: fact.propagationId,
            }).pipe(
              Effect.as(new WorkOrderReactorDispatchResult({
                workOrderId: decision.workOrderId,
                outcome: 'suspended',
              })),
              Effect.catchAll((error) => Effect.succeed(new WorkOrderReactorDispatchResult({
                workOrderId: decision.workOrderId,
                outcome: 'failed',
                error: String(error),
              }))),
            )
          },
          { concurrency: 8 },
        )

        return new WorkOrderReactorRunResult({ plan, results })
      }).pipe(Effect.withSpan('iiot.reactor.reactToMachineMaintenance'))

    const reactToEquipmentStateChange = (change: EquipmentStateChange) =>
      Effect.gen(function* () {
        if (!unavailableEquipmentStates.has(change.newState)) {
          return Option.none<WorkOrderReactorRunResult>()
        }

        const result = yield* reactToMachineMaintenance(new MachineMaintenanceFact({
          machineId: change.equipmentId as MachineIdType,
          reason: change.newState,
        }))

        return Option.some(result)
      }).pipe(Effect.withSpan('iiot.reactor.reactToEquipmentStateChange'))

    const checkpointOutcome = (result: WorkOrderReactorRunResult): ReactorCheckpointOutcome =>
      result.results.some((r) => r.outcome === 'failed') ? 'failed'
        : result.results.some((r) => r.outcome === 'suspended') ? 'processed'
        : 'skipped'

    const markCheckpoint = (
      repo: ReactorCheckpointRepository,
      entry: EventJournal.Entry,
      result: WorkOrderReactorRunResult,
    ) =>
      repo.markProcessed({
        consumerId: 'relationship-reactor-v1' as never,
        sourceEntryId: entry.idString as never,
        sourceEvent: entry.event,
        primaryKey: entry.primaryKey,
        outcome: checkpointOutcome(result),
        metadata: {
          resultCount: result.results.length,
          sourceMachineId: result.plan.sourceMachineId,
        },
      })

    const reactToJournalEntry = (entry: EventJournal.Entry) =>
      Effect.gen(function* () {
        if (entry.event !== 'EquipmentStateChanged') {
          return Option.none<WorkOrderReactorRunResult>()
        }

        if (Option.isSome(checkpoints)) {
          const alreadyProcessed = yield* checkpoints.value.hasProcessed({
            consumerId: 'relationship-reactor-v1' as never,
            sourceEntryId: entry.idString as never,
          })
          if (alreadyProcessed) return Option.none<WorkOrderReactorRunResult>()
        }

        const event = EquipmentStateEvents.events.EquipmentStateChanged
        const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entry.payload)

        const result = yield* reactToMachineMaintenance(new MachineMaintenanceFact({
          machineId: payload.machineId,
          reason: payload.newState,
          propagationId: entry.idString as PropagationIdType,
        }))

        if (Option.isSome(checkpoints)) {
          yield* markCheckpoint(checkpoints.value, entry, result)
        }

        return Option.some(result)
      }).pipe(Effect.withSpan('iiot.reactor.reactToJournalEntry'))

    const runEquipmentStateStream = Option.match(distribution, {
      onNone: () => Effect.logWarning('[RelationshipReactor] EventDistribution not provided; equipment stream sidecar disabled').pipe(Effect.asVoid),
      onSome: (hub) =>
        Effect.gen(function* () {
          const stream = yield* hub.subscribeEquipmentState
          yield* Stream.runForEach(stream, (change) =>
            reactToEquipmentStateChange(change).pipe(Effect.asVoid)
          )
        }),
    }).pipe(Effect.withSpan('iiot.reactor.runEquipmentStateStream'))

    return RelationshipReactor.of({
      planMachineMaintenance,
      reactToMachineMaintenance,
      reactToEquipmentStateChange,
      reactToJournalEntry,
      runEquipmentStateStream,
    })
  }),
)
