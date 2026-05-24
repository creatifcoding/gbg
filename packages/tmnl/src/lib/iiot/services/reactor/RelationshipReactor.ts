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

import { Context, DateTime, Effect, Layer, Option, Schema, Stream } from 'effect'
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
import { WorkOrderState } from '../../state'
import { EquipmentStateChange, EventDistribution } from '../../realtime/event-distribution'
import {
  ReactorCheckpointRepo,
  type ReactorCheckpointRepository,
} from '../../repos/ReactorCheckpointRepo'
import {
  ObservationSignal,
  ReactorCausality,
  ReactorEventEnvelope,
  ReactorObservation,
  type ReactorCheckpointOutcome,
  type ReactorPlan,
  type ReactorRun,
} from '../../schemas/reactor'
import { WorkOrderEntity } from '../../entity/WorkOrderEntity'
import {
  classifyWorkOrderSuspendEligibility,
  workOrderNotFoundSuspendEligibility,
} from '../../machines/graphs/work-order-eligibility'
import { EntityCapabilityIds, RelationshipEndpoint, TargetsMachineUnavailableBlocksSource } from '../../schemas/relationships'
import {
  makeReactorRegistry,
  ReactorRegistry,
  type EntityReactionContract,
} from './ReactorRegistry'
import { ReactorPlanner, ReactorPlannerLive } from './ReactorPlanner'
import { ReactorDispatcher, ReactorDispatcherLive } from './ReactorDispatcher'
import { EquipmentStateChangedObservationSpec } from './observations'

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
        return client.WorkOrder.Suspend({
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

const unavailableEquipmentStates = new Set([
  'maintenance',
  'planned_downtime',
  'unplanned_downtime',
  'faulted',
  'offline',
])

const classifyWorkOrder = (workOrder: WorkOrder): WorkOrderReactorDecision => {
  const eligibility = classifyWorkOrderSuspendEligibility(workOrder)
  return new WorkOrderReactorDecision({
    workOrderId: workOrder.id,
    status: workOrder.status,
    eligible: eligibility.eligible,
    skipReason: eligibility.reason as WorkOrderReactorSkipReason | undefined,
  })
}

const notFoundDecision = (workOrderId: WorkOrderIdType): WorkOrderReactorDecision => {
  const eligibility = workOrderNotFoundSuspendEligibility(workOrderId)
  return new WorkOrderReactorDecision({
    workOrderId,
    status: 'closed',
    eligible: false,
    skipReason: eligibility.reason as WorkOrderReactorSkipReason | undefined,
  })
}

const toLegacySkipReason = (reason: string | undefined): WorkOrderReactorSkipReason | undefined => {
  switch (reason) {
    case 'not_found':
    case 'terminal_state':
    case 'not_started':
    case 'already_suspended':
      return reason
    case 'duplicate_propagation':
      return 'already_suspended'
    default:
      return undefined
  }
}

const makeMachineUnavailableObservation = (fact: MachineMaintenanceFact): ReactorObservation =>
  new ReactorObservation({
    event: new ReactorEventEnvelope({
      entryId: (fact.propagationId ?? `LEGACY-MACHINE-MAINTENANCE-${fact.machineId}`) as never,
      tag: 'MachineMaintenanceFact',
      primaryKey: fact.machineId,
      occurredAt: DateTime.unsafeNow(),
    }),
    subject: new RelationshipEndpoint({ type: 'machine', id: fact.machineId }),
    signals: [new ObservationSignal({
      axis: 'equipment.availability',
      kind: 'condition_asserted',
      value: 'unavailable',
      reason: fact.reason ?? 'machine_unavailable',
    })],
    causality: new ReactorCausality({
      propagationId: (fact.propagationId ?? `PROP-LEGACY-${fact.machineId}`) as PropagationIdType,
    }),
    payload: fact,
  })

const RelationshipReactorRegistryLive = Layer.effect(
  ReactorRegistry,
  Effect.gen(function* () {
    const workOrders = yield* WorkOrderState
    const dispatcher = yield* WorkOrderReactorDispatcher

    const contract: EntityReactionContract = {
      entityType: 'work_order',
      capabilities: new Map([
        [EntityCapabilityIds.DependencyBlocked, {
          id: EntityCapabilityIds.DependencyBlocked,
          classify: (request) =>
            workOrders.get(request.target.id as WorkOrderIdType).pipe(
              Effect.map(classifyWorkOrderSuspendEligibility),
              Effect.catchAll(() => Effect.succeed(workOrderNotFoundSuspendEligibility(request.target.id))),
            ),
          dispatch: (request) =>
            dispatcher.suspendForEquipmentUnavailable({
              workOrderId: request.target.id as WorkOrderIdType,
              sourceMachineId: request.source.id as MachineIdType,
              propagationId: request.causality.propagationId,
            }),
        }],
      ]),
    }

    return ReactorRegistry.of(makeReactorRegistry({
      observations: [EquipmentStateChangedObservationSpec],
      propagationPolicies: [TargetsMachineUnavailableBlocksSource],
      entities: [contract],
    }))
  }),
)

const RelationshipReactorServiceLive = Layer.effect(
  RelationshipReactor,
  Effect.gen(function* () {
    const workOrders = yield* WorkOrderState
    const planner = yield* ReactorPlanner
    const genericDispatcher = yield* ReactorDispatcher
    const distribution = yield* Effect.serviceOption(EventDistribution)
    const checkpoints = yield* Effect.serviceOption(ReactorCheckpointRepo)

    const legacyPlanFromGeneric = (
      genericPlan: ReactorPlan,
      input: {
        readonly sourceMachineId: MachineIdType
        readonly reason: string
        readonly propagationId?: PropagationIdType
      },
    ) =>
      Effect.gen(function* () {
        const decisions = yield* Effect.forEach(
          genericPlan.decisions,
          (decision) =>
            workOrders.get(decision.target.id as WorkOrderIdType).pipe(
              Effect.map(classifyWorkOrder),
              Effect.catchAll(() => Effect.succeed(notFoundDecision(decision.target.id as WorkOrderIdType))),
            ),
          { concurrency: 'unbounded' },
        )

        return new WorkOrderReactorPlan({
          sourceMachineId: input.sourceMachineId,
          reason: input.reason,
          propagationId: input.propagationId,
          decisions,
        })
      })

    const legacyRunFromGeneric = (
      legacyPlan: WorkOrderReactorPlan,
      genericRun: ReactorRun,
    ): WorkOrderReactorRunResult =>
      new WorkOrderReactorRunResult({
        plan: legacyPlan,
        results: genericRun.results.map((result) => new WorkOrderReactorDispatchResult({
          workOrderId: result.target.id as WorkOrderIdType,
          outcome: result.outcome === 'dispatched'
            ? 'suspended'
            : result.outcome === 'failed'
              ? 'failed'
              : 'skipped',
          skipReason: result.outcome === 'skipped' ? toLegacySkipReason(result.reason) : undefined,
          error: result.outcome === 'failed' ? result.reason : undefined,
        })),
      })

    const planMachineMaintenance = (fact: MachineMaintenanceFact) =>
      Effect.gen(function* () {
        const observation = makeMachineUnavailableObservation(fact)
        const genericPlan = yield* planner.planObservation(observation)
        return yield* legacyPlanFromGeneric(genericPlan, {
          sourceMachineId: fact.machineId,
          reason: fact.reason ?? 'machine_unavailable',
          propagationId: fact.propagationId,
        })
      }).pipe(Effect.withSpan('iiot.reactor.planMachineMaintenance'))

    const reactToMachineMaintenance = (fact: MachineMaintenanceFact) =>
      Effect.gen(function* () {
        const observation = makeMachineUnavailableObservation(fact)
        const genericPlan = yield* planner.planObservation(observation)
        const legacyPlan = yield* legacyPlanFromGeneric(genericPlan, {
          sourceMachineId: fact.machineId,
          reason: fact.reason ?? 'machine_unavailable',
          propagationId: fact.propagationId,
        })
        const genericRun = yield* genericDispatcher.execute(genericPlan)
        return legacyRunFromGeneric(legacyPlan, genericRun)
      }).pipe(Effect.withSpan('iiot.reactor.reactToMachineMaintenance'))

    const reactToEquipmentStateChange = (change: EquipmentStateChange) =>
      Effect.gen(function* () {
        if (!unavailableEquipmentStates.has(change.newState)) {
          return Option.none<WorkOrderReactorRunResult>()
        }

        const result = yield* reactToMachineMaintenance(new MachineMaintenanceFact({
          machineId: change.equipmentId as MachineIdType,
          reason: change.newState,
          propagationId: change.propagationId as PropagationIdType | undefined,
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
        if (Option.isSome(checkpoints)) {
          const alreadyProcessed = yield* checkpoints.value.hasProcessed({
            consumerId: 'relationship-reactor-v1' as never,
            sourceEntryId: entry.idString as never,
          })
          if (alreadyProcessed) return Option.none<WorkOrderReactorRunResult>()
        }

        const genericPlanOption = yield* planner.planJournalEntry(entry)
        if (Option.isNone(genericPlanOption)) {
          return Option.none<WorkOrderReactorRunResult>()
        }

        const genericPlan = genericPlanOption.value
        const sourceMachineId = genericPlan.observation.subject.id as MachineIdType
        const reason = genericPlan.observation.signals[0]?.reason ?? 'machine_unavailable'
        const propagationId = genericPlan.observation.causality.propagationId as PropagationIdType
        const legacyPlan = yield* legacyPlanFromGeneric(genericPlan, {
          sourceMachineId,
          reason,
          propagationId,
        })
        const genericRun = yield* genericDispatcher.execute(genericPlan)
        const result = legacyRunFromGeneric(legacyPlan, genericRun)

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

export const RelationshipReactorLive = RelationshipReactorServiceLive.pipe(
  Layer.provide(ReactorDispatcherLive),
  Layer.provide(ReactorPlannerLive),
  Layer.provide(RelationshipReactorRegistryLive),
)
