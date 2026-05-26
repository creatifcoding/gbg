/**
 * WorkOrder depends_on guarded Reactor lane integration tests.
 *
 * Proves the opt-in WorkOrder dependency lane can observe upstream WorkOrder
 * events over graph topology, assert SQL constraints, and dispatch target-owned
 * downstream WorkOrder transitions.
 */

import { beforeAll, afterEach, describe, expect, it } from 'vitest'
import { DateTime, Effect, Layer, Option } from 'effect'
import { Entity, ShardingConfig } from '@effect/cluster'
import * as EventLog from '@effect/experimental/EventLog'
import * as EventJournal from '@effect/experimental/EventJournal'
import { PgClient } from '@effect/sql-pg'
import type { PropagationId, WorkOrderId, WorkflowDefinitionId } from '../../schemas/identifiers'
import { WorkOrder, type WorkOrderStatus } from '../../schemas/work-orders'
import {
  EntityCapabilityIds,
  RelationshipEdgeMetadata,
  RelationshipEndpoint,
  eligible,
  skipped,
} from '../../schemas/relationships'
import { WorkOrderEvents } from '../../schemas/events/groups'
import { WorkOrderState } from '../../state'
import { WorkOrderEntity, WorkOrderEntityHandlers } from '../../entity/WorkOrderEntity'
import { WorkOrderTransitionRepo } from '../../repos'
import { GraphClient } from '../../services/l1/GraphClient'
import { DomainEventEmitter, DomainEventEmitterLive } from '../../services/events'
import {
  IIoTDomainEventHandlersLayer,
  IIoTEventLogLayer,
} from '../../infrastructure/eventlog-layer'
import {
  Reactor,
  ReactorAdmissionControlLive,
  ReactorConstraintAuthority,
  ReactorConstraintAuthoritySqlLive,
  ReactorDispatcherLive,
  ReactorLive,
  ReactorPlannerLive,
  ReactorRegistry,
  WorkOrderDependencyRelease,
  WorkOrderDependencyReleaseLive,
  WorkOrderDependencyReleaseTransition,
  makeReactorRegistry,
  type EntityReactionContract,
} from '../../services/reactor'
import {
  ReactorDependsOnObservationSpecs,
  ReactorDependsOnPropagationPolicies,
} from '../../services/reactor/layers'
import {
  sqlConstraintAssertionFromRequest,
  suspensionReasonFromRequest,
} from '../../services/reactor/contracts/work-order'
import {
  classifyWorkOrderSuspendEligibility,
  workOrderNotFoundSuspendEligibility,
} from '../../machines/graphs/work-order-eligibility'
import {
  EventJournalIntegrationLayer,
  GraphIntegrationLayer,
  TestPgClientWithMigrations,
  isDatabaseAvailable,
} from './layer'
import {
  WorkOrderMachineIntegrationLayer,
  cleanMachineTestData,
  setupMachineTestHierarchy,
} from './machines/layer'

const TestShardingConfig = ShardingConfig.layer({
  shardsPerGroup: 10,
  entityMailboxCapacity: 10,
  entityTerminationTimeout: 0,
  entityMessagePollInterval: 5000,
  sendRetryInterval: 100,
})

const WorkOrderEntityHandlerIntegrationLayer = WorkOrderEntityHandlers.pipe(
  Layer.provide(WorkOrderMachineIntegrationLayer),
)

const ConstraintAuthorityLayer = ReactorConstraintAuthoritySqlLive.pipe(
  Layer.provide(TestPgClientWithMigrations),
)

const WorkOrderEntityReleaseTransitionLayer = Layer.effect(
  WorkOrderDependencyReleaseTransition,
  Effect.gen(function* () {
    const makeClient = yield* Entity.makeTestClient(
      WorkOrderEntity,
      WorkOrderEntityHandlerIntegrationLayer,
    )

    return WorkOrderDependencyReleaseTransition.of({
      resume: (input) => Effect.gen(function* () {
        const client = yield* makeClient(input.workOrderId)
        return yield* client.WorkOrder.Resume({
          workOrderId: input.workOrderId,
          notes: Option.some(input.note),
          causedByPropagationId: Option.some(input.causedByPropagationId),
        })
      }),
    })
  }),
)

const ReleaseDependenciesLayer = Layer.mergeAll(
  WorkOrderMachineIntegrationLayer,
  ConstraintAuthorityLayer,
  WorkOrderEntityReleaseTransitionLayer,
  ReactorAdmissionControlLive,
)

const WorkOrderDependencyReleaseTestLayer = WorkOrderDependencyReleaseLive.pipe(
  Layer.provide(ReleaseDependenciesLayer),
)

const DependsOnE2ERegistryLayer = Layer.effect(
  ReactorRegistry,
  Effect.gen(function* () {
    const workOrders = yield* WorkOrderState
    const transitionRepo = yield* Effect.serviceOption(WorkOrderTransitionRepo)
    const constraintAuthority = yield* ReactorConstraintAuthority
    const release = yield* WorkOrderDependencyRelease
    const makeClient = yield* Entity.makeTestClient(
      WorkOrderEntity,
      WorkOrderEntityHandlerIntegrationLayer,
    )

    const contract: EntityReactionContract = {
      entityType: 'work_order',
      capabilities: new Map([
        [EntityCapabilityIds.DependencyBlocked, {
          id: EntityCapabilityIds.DependencyBlocked,
          classify: (request) =>
            Effect.gen(function* () {
              const workOrderId = request.target.id as WorkOrderId
              const alreadyHandledPropagation = Option.isSome(transitionRepo)
                ? yield* transitionRepo.value.hasInboundPropagation(workOrderId, request.causality.propagationId)
                : false

              return yield* workOrders.get(workOrderId).pipe(
                Effect.map((workOrder) => classifyWorkOrderSuspendEligibility(workOrder, {
                  causedByPropagationId: request.causality.propagationId,
                  alreadyHandledPropagation,
                })),
                Effect.catchAll(() => Effect.succeed(workOrderNotFoundSuspendEligibility(workOrderId))),
              )
            }),
          dispatch: (request) =>
            Effect.gen(function* () {
              const assertion = sqlConstraintAssertionFromRequest(request)
              if (assertion === undefined) {
                return yield* Effect.fail(new Error('missing Reactor constraint assertion metadata'))
              }

              yield* constraintAuthority.assert(assertion)
              const client = yield* makeClient(request.target.id)
              return yield* client.WorkOrder.Suspend({
                workOrderId: request.target.id as WorkOrderId,
                reason: suspensionReasonFromRequest(request.payload),
                expectedResume: Option.none(),
                causedByPropagationId: Option.some(request.causality.propagationId),
                notes: Option.some(`depends_on Reactor block from ${request.source.id}`),
              })
            }),
        }],
        [EntityCapabilityIds.DependencySatisfied, {
          id: EntityCapabilityIds.DependencySatisfied,
          classify: (request) => Effect.succeed(skipped({
            entityType: 'work_order',
            entityId: request.target.id,
            targetState: 'started',
            reason: 'satisfied_capability_parked',
            remediation: 'dependency.satisfied is informational until the target-owned progression contract is designed.',
          })),
          dispatch: () => Effect.void,
        }],
        [EntityCapabilityIds.DependencyReleased, {
          id: EntityCapabilityIds.DependencyReleased,
          classify: release.classify,
          dispatch: release.dispatch,
        }],
      ]),
    }

    return ReactorRegistry.of(makeReactorRegistry({
      observations: ReactorDependsOnObservationSpecs,
      propagationPolicies: ReactorDependsOnPropagationPolicies,
      entities: [contract],
    }))
  }),
)

const DependsOnE2EReactorLayer = ReactorLive.pipe(
  Layer.provide(ReactorDispatcherLive.pipe(Layer.provide(ReactorAdmissionControlLive))),
  Layer.provide(ReactorPlannerLive),
  Layer.provide(DependsOnE2ERegistryLayer),
  Layer.provide(ReactorAdmissionControlLive),
)

const DependsOnE2EDependenciesLayer = Layer.mergeAll(
  WorkOrderMachineIntegrationLayer,
  ConstraintAuthorityLayer,
  GraphIntegrationLayer,
  WorkOrderDependencyReleaseTestLayer,
)

const DependsOnE2ELayer = Layer.merge(
  DependsOnE2EDependenciesLayer,
  DependsOnE2EReactorLayer.pipe(Layer.provide(DependsOnE2EDependenciesLayer)),
)

const makeEmitterLayer = (journal: EventJournal.EventJournal.Service) => {
  const baseLayer = Layer.mergeAll(
    Layer.succeed(EventJournal.EventJournal, journal),
    Layer.succeed(EventLog.Identity, EventLog.Identity.makeRandom()),
    IIoTDomainEventHandlersLayer,
  )

  return DomainEventEmitterLive.pipe(
    Layer.provide(IIoTEventLogLayer.pipe(Layer.provide(baseLayer))),
  )
}

const makeWorkOrder = (id: WorkOrderId, status: WorkOrderStatus, patch: Partial<WorkOrder> = {}) => new WorkOrder({
  id,
  workflowDefinitionId: 'WF-REACTOR-DEPENDS-ON' as WorkflowDefinitionId,
  workflowVersion: '1',
  title: `Depends_on Reactor fixture ${id}`,
  description: 'WorkOrder depends_on Reactor lane fixture',
  type: 'preventive_maintenance',
  priority: 'normal',
  status,
  createdBy: 'reactor-depends-on-e2e',
  createdAt: DateTime.unsafeNow(),
  scheduledStart: Option.none(),
  dueDate: Option.none(),
  actualStart: Option.none(),
  actualEnd: Option.none(),
  parentWorkOrderId: Option.none(),
  primaryAssetId: Option.none(),
  assignedTo: Option.none(),
  outcome: Option.none(),
  summary: Option.none(),
  failedTaskId: Option.none(),
  failureReason: Option.none(),
  suspensionReason: Option.none(),
  expectedResume: Option.none(),
  cancellationReason: Option.none(),
  compensationRequired: false,
  finalStatus: Option.none(),
  metadata: {},
  transitions: [],
  ...patch,
})

let sequence = 0
const nextWorkOrderId = (label: string): WorkOrderId =>
  `TEST-WO-DEPENDS-ON-${label}-${Date.now()}-${++sequence}` as WorkOrderId

const insertWorkOrder = (workOrder: WorkOrder) => Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`
    INSERT INTO iiot.work_orders (
      id,
      workflow_definition_id,
      workflow_version,
      title,
      description,
      type,
      priority,
      status,
      created_by,
      suspension_reason,
      failure_reason,
      cancellation_reason,
      metadata
    ) VALUES (
      ${workOrder.id},
      ${workOrder.workflowDefinitionId},
      ${workOrder.workflowVersion},
      ${workOrder.title},
      ${workOrder.description},
      ${workOrder.type},
      ${workOrder.priority},
      ${workOrder.status},
      ${workOrder.createdBy},
      ${Option.getOrNull(workOrder.suspensionReason)},
      ${Option.getOrNull(workOrder.failureReason)},
      ${Option.getOrNull(workOrder.cancellationReason)},
      ${{ fixture: 'reactor-work-order-depends-on-e2e' }}::jsonb
    )
  `
})

const cleanupDependsOnE2E = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`
    DELETE FROM iiot.reactor_constraints
    WHERE target_id LIKE 'TEST-WO-DEPENDS-ON-%'
       OR source_id LIKE 'TEST-WO-DEPENDS-ON-%'
  `.pipe(Effect.ignore)
  yield* sql`
    DELETE FROM iiot.work_order_transitions
    WHERE work_order_id LIKE 'TEST-WO-DEPENDS-ON-%'
  `.pipe(Effect.ignore)
  yield* sql`
    DELETE FROM iiot.work_orders
    WHERE id LIKE 'TEST-WO-DEPENDS-ON-%'
  `.pipe(Effect.ignore)
  yield* cleanMachineTestData.pipe(Effect.ignore)
})

const emitUpstreamEvent = (input: {
  readonly tag: 'WorkOrderSuspended' | 'WorkOrderFailed' | 'WorkOrderCancelled' | 'WorkOrderResumed'
  readonly upstream: WorkOrder
  readonly propagationId: PropagationId
  readonly journal: EventJournal.EventJournal.Service
}) => Effect.gen(function* () {
  const emitter = yield* DomainEventEmitter
  yield* emitter.emitWorkOrderLifecycleStrict({
    tag: input.tag,
    workOrder: input.upstream,
    actor: 'reactor-depends-on-e2e',
    reason: 'depends_on fixture upstream state',
    notes: 'depends_on e2e event',
    propagationId: input.tag === 'WorkOrderSuspended' ? input.propagationId : undefined,
    causedByPropagationId: input.tag === 'WorkOrderSuspended' || input.tag === 'WorkOrderResumed'
      ? input.propagationId
      : undefined,
  })
}).pipe(Effect.provide(makeEmitterLayer(input.journal)))

describe('WorkOrder depends_on Reactor lane', () => {
  let dbAvailable = false

  beforeAll(async () => {
    dbAvailable = await Effect.runPromise(
      isDatabaseAvailable.pipe(Effect.provide(DependsOnE2ELayer), Effect.scoped, Effect.provide(TestShardingConfig)),
    )
    if (!dbAvailable) {
      console.log('SKIPPING: IIoT database not available')
      return
    }
  }, 30000)

  afterEach(async () => {
    if (!dbAvailable) return
    await Effect.runPromise(
      cleanupDependsOnE2E.pipe(Effect.provide(DependsOnE2ELayer), Effect.scoped, Effect.provide(TestShardingConfig)),
    )
  })

  it.each([
    ['WorkOrderSuspended', 'suspended'] as const,
    ['WorkOrderFailed', 'failed'] as const,
    ['WorkOrderCancelled', 'cancelled'] as const,
  ])('blocks downstream WorkOrders when upstream emits %s', async (tag, upstreamStatus) => {
    if (!dbAvailable) return

    await Effect.runPromise(Effect.gen(function* () {
      yield* cleanupDependsOnE2E
      yield* setupMachineTestHierarchy

      const downstreamId = nextWorkOrderId('DOWNSTREAM')
      const upstreamId = nextWorkOrderId('UPSTREAM')
      const propagationId = `PROP-DEPENDS-ON-${tag}-${Date.now()}` as PropagationId
      const downstream = makeWorkOrder(downstreamId, 'started')
      const upstream = makeWorkOrder(upstreamId, upstreamStatus, {
        suspensionReason: upstreamStatus === 'suspended' ? Option.some('external_dependency') : Option.none(),
        failureReason: upstreamStatus === 'failed' ? Option.some('upstream failed') : Option.none(),
        cancellationReason: upstreamStatus === 'cancelled' ? Option.some('upstream cancelled') : Option.none(),
      })

      yield* insertWorkOrder(downstream)
      yield* insertWorkOrder(upstream)

      const graph = yield* GraphClient
      yield* graph.upsertRelationshipNode({ type: 'work_order', id: downstreamId }, { status: 'started' })
      yield* graph.upsertRelationshipNode({ type: 'work_order', id: upstreamId }, { status: upstreamStatus })
      yield* graph.upsertRelationshipEdge({
        source: { type: 'work_order', id: downstreamId },
        target: { type: 'work_order', id: upstreamId },
        edgeType: 'depends_on',
        metadata: new RelationshipEdgeMetadata({
          createdBy: 'reactor-depends-on-e2e',
          reason: 'downstream depends on upstream',
        }),
      })

      const journal = yield* EventJournal.makeMemory
      yield* emitUpstreamEvent({ tag, upstream, propagationId, journal })
      const entries = yield* journal.entries
      const entry = entries.find((candidate) => candidate.event === tag)
      expect(entry).toBeDefined()

      const reactor = yield* Reactor
      const runOption = yield* reactor.reactToJournalEntry(entry!)
      expect(Option.isSome(runOption)).toBe(true)

      const run = Option.getOrThrow(runOption)
      expect(run.results).toEqual(expect.arrayContaining([
        expect.objectContaining({
          target: expect.objectContaining({ type: 'work_order', id: downstreamId }),
          outcome: 'dispatched',
        }),
      ]))

      const workOrders = yield* WorkOrderState
      const authority = yield* ReactorConstraintAuthority
      const updated = yield* workOrders.get(downstreamId)
      const constraints = yield* authority.activeForTarget(new RelationshipEndpoint({ type: 'work_order', id: downstreamId }))

      expect(updated.status).toBe('suspended')
      expect(Option.getOrNull(updated.suspensionReason)).toBe('external_dependency')
      expect(constraints).toHaveLength(1)
      expect(constraints[0]?.identity.policyId).toBe('depends_on.work-order-blocked.blocks-source')
      expect(constraints[0]?.identity.relationshipEdgeType).toBe('depends_on')
      expect(constraints[0]?.identity.source.id).toBe(upstreamId)
      expect(constraints[0]?.identity.propagationId).toBe(run.plan.observation.causality.propagationId)
    }).pipe(
      Effect.provide(DependsOnE2ELayer),
      Effect.scoped,
      Effect.provide(TestShardingConfig),
    ))
  }, 30000)

  it('retracts the exact depends_on block and resumes downstream only after all constraints clear', async () => {
    if (!dbAvailable) return

    await Effect.runPromise(Effect.gen(function* () {
      yield* cleanupDependsOnE2E
      yield* setupMachineTestHierarchy

      const downstreamId = nextWorkOrderId('DOWNSTREAM-RELEASE')
      const upstreamId = nextWorkOrderId('UPSTREAM-RELEASE')
      const blockedPropagationId = `PROP-DEPENDS-ON-BLOCKED-${Date.now()}` as PropagationId
      const downstream = makeWorkOrder(downstreamId, 'started')
      const upstreamSuspended = makeWorkOrder(upstreamId, 'suspended', {
        suspensionReason: Option.some('external_dependency'),
      })

      yield* insertWorkOrder(downstream)
      yield* insertWorkOrder(upstreamSuspended)

      const graph = yield* GraphClient
      yield* graph.upsertRelationshipNode({ type: 'work_order', id: downstreamId }, { status: 'started' })
      yield* graph.upsertRelationshipNode({ type: 'work_order', id: upstreamId }, { status: 'suspended' })
      yield* graph.upsertRelationshipEdge({
        source: { type: 'work_order', id: downstreamId },
        target: { type: 'work_order', id: upstreamId },
        edgeType: 'depends_on',
        metadata: new RelationshipEdgeMetadata({
          createdBy: 'reactor-depends-on-e2e',
          reason: 'downstream depends on upstream for release',
        }),
      })

      const journal = yield* EventJournal.makeMemory
      yield* emitUpstreamEvent({
        tag: 'WorkOrderSuspended',
        upstream: upstreamSuspended,
        propagationId: blockedPropagationId,
        journal,
      })
      const blockEntry = (yield* journal.entries).find((candidate) => candidate.event === 'WorkOrderSuspended')
      expect(blockEntry).toBeDefined()

      const reactor = yield* Reactor
      const blockRunOption = yield* reactor.reactToJournalEntry(blockEntry!)
      expect(Option.isSome(blockRunOption)).toBe(true)

      const workOrders = yield* WorkOrderState
      const authority = yield* ReactorConstraintAuthority
      const target = new RelationshipEndpoint({ type: 'work_order', id: downstreamId })
      const blocked = yield* workOrders.get(downstreamId)
      const activeAfterBlock = yield* authority.activeForTarget(target)
      expect(blocked.status).toBe('suspended')
      expect(activeAfterBlock).toHaveLength(1)
      expect(activeAfterBlock[0]?.identity.propagationId).toBe(blockedPropagationId)

      const upstreamResumed = makeWorkOrder(upstreamId, 'resumed')
      yield* emitUpstreamEvent({
        tag: 'WorkOrderResumed',
        upstream: upstreamResumed,
        propagationId: blockedPropagationId,
        journal,
      })
      const resumeEntry = (yield* journal.entries).find((candidate) => candidate.event === 'WorkOrderResumed')
      expect(resumeEntry).toBeDefined()

      const releaseRunOption = yield* reactor.reactToJournalEntry(resumeEntry!)
      expect(Option.isSome(releaseRunOption)).toBe(true)
      const releaseRun = Option.getOrThrow(releaseRunOption)
      expect(releaseRun.results).toEqual(expect.arrayContaining([
        expect.objectContaining({
          target: expect.objectContaining({ type: 'work_order', id: downstreamId }),
          outcome: 'dispatched',
        }),
      ]))

      const released = yield* workOrders.get(downstreamId)
      const activeAfterRelease = yield* authority.activeForTarget(target)
      const transitionRepo = yield* WorkOrderTransitionRepo
      const transitions = yield* transitionRepo.getByWorkOrderId(downstreamId)
      const resumedTransition = transitions.find((transition) => transition.toState === 'resumed')

      expect(activeAfterRelease).toHaveLength(0)
      expect(released.status).toBe('resumed')
      expect(Option.isNone(released.suspensionReason)).toBe(true)
      expect(resumedTransition).toBeDefined()
      expect(Option.getOrNull(resumedTransition?.causedByPropagationId ?? Option.none())).toBe(
        releaseRun.plan.observation.causality.propagationId,
      )
      expect(releaseRun.plan.observation.causality.causedByPropagationId).toBe(blockedPropagationId)
    }).pipe(
      Effect.provide(DependsOnE2ELayer),
      Effect.scoped,
      Effect.provide(TestShardingConfig),
    ))
  }, 30000)
})
