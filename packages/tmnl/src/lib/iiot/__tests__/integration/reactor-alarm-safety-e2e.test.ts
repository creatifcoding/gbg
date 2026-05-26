/** Alarm safety-hold guarded Reactor lane integration tests. */

import { beforeAll, afterEach, describe, expect, it } from 'vitest'
import { DateTime, Effect, Layer, Option, Schema } from 'effect'
import { Entity, ShardingConfig } from '@effect/cluster'
import * as EventJournal from '@effect/experimental/EventJournal'
import { PgClient } from '@effect/sql-pg'
import type { AlarmId, AssetId, DeviceId, EventId, WorkOrderId, WorkflowDefinitionId } from '../../schemas/identifiers'
import { WorkOrder, type WorkOrderStatus } from '../../schemas/work-orders'
import {
  EntityCapabilityIds,
  RELATIONSHIP_EDGE_REGISTRY,
  RelationshipEdgeMetadata,
  RelationshipEdges,
  RelationshipEndpoints,
  eligible,
} from '../../schemas/relationships'
import { WorkOrderState } from '../../state'
import { WorkOrderEntity, WorkOrderEntityHandlers } from '../../entity/WorkOrderEntity'
import { WorkOrderTransitionRepo } from '../../repos'
import { GraphClient } from '../../services/l1/GraphClient'
import { AlarmEvents } from '../../schemas/events/groups'
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
  ReactorAlarmSafetyObservationSpecs,
  ReactorAlarmSafetyPropagationPolicies,
} from '../../services/reactor/layers'
import { sqlConstraintAssertionFromRequest } from '../../services/reactor/contracts/work-order'
import {
  classifyWorkOrderSuspendEligibility,
  workOrderNotFoundSuspendEligibility,
} from '../../machines/graphs/work-order-eligibility'
import { GraphIntegrationLayer, TestPgClientWithMigrations, isDatabaseAvailable } from './layer'
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
    const makeClient = yield* Entity.makeTestClient(WorkOrderEntity, WorkOrderEntityHandlerIntegrationLayer)
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

const AlarmSafetyRegistryLayer = Layer.effect(
  ReactorRegistry,
  Effect.gen(function* () {
    const workOrders = yield* WorkOrderState
    const transitionRepo = yield* Effect.serviceOption(WorkOrderTransitionRepo)
    const constraintAuthority = yield* ReactorConstraintAuthority
    const release = yield* WorkOrderDependencyRelease
    const makeClient = yield* Entity.makeTestClient(WorkOrderEntity, WorkOrderEntityHandlerIntegrationLayer)

    const classifyHold = (request: Parameters<EntityReactionContract['capabilities']['get']>[0] extends never ? never : any) =>
      Effect.gen(function* () {
        const workOrderId = request.target.id as WorkOrderId
        const alreadyHandledPropagation = Option.isSome(transitionRepo)
          ? yield* transitionRepo.value.hasInboundPropagation(workOrderId, request.causality.propagationId)
          : false

        return yield* workOrders.get(workOrderId).pipe(
          Effect.map((workOrder) => {
            if (alreadyHandledPropagation) {
              return classifyWorkOrderSuspendEligibility(workOrder, {
                causedByPropagationId: request.causality.propagationId,
                alreadyHandledPropagation,
              })
            }
            if (workOrder.status === 'suspended') {
              return eligible({
                entityType: 'work_order',
                entityId: workOrder.id,
                currentState: workOrder.status,
                targetState: 'suspended',
              })
            }
            return classifyWorkOrderSuspendEligibility(workOrder, {
              causedByPropagationId: request.causality.propagationId,
              alreadyHandledPropagation,
            })
          }),
          Effect.catchAll(() => Effect.succeed(workOrderNotFoundSuspendEligibility(workOrderId))),
        )
      })

    const contract: EntityReactionContract = {
      entityType: 'work_order',
      capabilities: new Map([
        [EntityCapabilityIds.SafetyHold, {
          id: EntityCapabilityIds.SafetyHold,
          classify: classifyHold,
          dispatch: (request) => Effect.gen(function* () {
            const assertion = sqlConstraintAssertionFromRequest(request, {
              capability: EntityCapabilityIds.SafetyHold,
              family: 'safety',
              effect: 'holding',
            })
            if (assertion === undefined) return yield* Effect.fail(new Error('missing safety assertion metadata'))
            yield* constraintAuthority.assert(assertion)

            const workOrderId = request.target.id as WorkOrderId
            const current = yield* workOrders.get(workOrderId)
            if (current.status === 'suspended') return current

            const client = yield* makeClient(workOrderId)
            return yield* client.WorkOrder.Suspend({
              workOrderId,
              reason: 'safety_hold',
              expectedResume: Option.none(),
              causedByPropagationId: Option.some(request.causality.propagationId),
              notes: Option.some(`alarm safety hold from ${request.source.id}`),
            })
          }),
        }],
        [EntityCapabilityIds.SafetyRelease, {
          id: EntityCapabilityIds.SafetyRelease,
          classify: release.classify,
          dispatch: release.dispatch,
        }],
      ]),
    }

    return ReactorRegistry.of(makeReactorRegistry({
      observations: ReactorAlarmSafetyObservationSpecs,
      propagationPolicies: ReactorAlarmSafetyPropagationPolicies,
      entities: [contract],
    }))
  }),
)

const AlarmSafetyReactorLayer = ReactorLive.pipe(
  Layer.provide(ReactorDispatcherLive.pipe(Layer.provide(ReactorAdmissionControlLive))),
  Layer.provide(ReactorPlannerLive),
  Layer.provide(AlarmSafetyRegistryLayer),
  Layer.provide(ReactorAdmissionControlLive),
)

const AlarmSafetyDependenciesLayer = Layer.mergeAll(
  WorkOrderMachineIntegrationLayer,
  ConstraintAuthorityLayer,
  GraphIntegrationLayer,
  WorkOrderDependencyReleaseTestLayer,
)

const AlarmSafetyE2ELayer = Layer.merge(
  AlarmSafetyDependenciesLayer,
  AlarmSafetyReactorLayer.pipe(Layer.provide(AlarmSafetyDependenciesLayer)),
)

const makeWorkOrder = (id: WorkOrderId, status: WorkOrderStatus) => new WorkOrder({
  id,
  workflowDefinitionId: 'WF-REACTOR-ALARM-SAFETY' as WorkflowDefinitionId,
  workflowVersion: '1',
  title: `Alarm safety Reactor fixture ${id}`,
  description: 'Alarm safety Reactor lane fixture',
  type: 'preventive_maintenance',
  priority: 'normal',
  status,
  createdBy: 'reactor-alarm-safety-e2e',
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
})

let sequence = 0
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${++sequence}`

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
      ${{ fixture: 'reactor-alarm-safety-e2e' }}::jsonb
    )
  `
})

const cleanupAlarmSafetyE2E = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`
    DELETE FROM iiot.reactor_constraints
    WHERE target_id LIKE 'TEST-WO-ALARM-SAFETY-%'
       OR source_id LIKE 'TEST-DEV-ALARM-SAFETY-%'
  `.pipe(Effect.ignore)
  yield* sql`
    DELETE FROM iiot.work_order_transitions
    WHERE work_order_id LIKE 'TEST-WO-ALARM-SAFETY-%'
  `.pipe(Effect.ignore)
  yield* sql`
    DELETE FROM iiot.work_orders
    WHERE id LIKE 'TEST-WO-ALARM-SAFETY-%'
  `.pipe(Effect.ignore)
  yield* cleanMachineTestData.pipe(Effect.ignore)
})

const alarmPayloadBase = (alarmId: AlarmId, deviceId: DeviceId) => ({
  eventId: `EVT-${alarmId}` as EventId,
  occurredAt: DateTime.unsafeNow(),
  causedBy: 'reactor-alarm-safety-e2e',
  entityId: deviceId as unknown as AssetId,
  entityType: 'device' as const,
  correlationId: Option.none(),
  schemaVersion: 1,
  alarmId,
  deviceId,
})

const makeAlarmEntry = (input: {
  readonly tag: 'AlarmTriggered' | 'AlarmCleared'
  readonly alarmId: AlarmId
  readonly deviceId: DeviceId
}) => Effect.gen(function* () {
  const base = alarmPayloadBase(input.alarmId, input.deviceId)
  const payload = input.tag === 'AlarmTriggered'
    ? {
      ...base,
      severity: 'critical' as const,
      alarmType: 'high_temperature' as const,
      triggerValue: 99,
      thresholdValue: Option.some(80),
      unit: Option.some('C'),
      message: Option.some('critical alarm safety hold'),
      metadata: Option.none(),
    }
    : {
      ...base,
      clearValue: Option.some(72),
      autoClear: true,
      notes: Option.some('alarm cleared'),
    }
  const event = AlarmEvents.events[input.tag] as { payloadMsgPack: Schema.Schema<unknown, Uint8Array> }
  const encodedPayload = yield* Schema.encode(event.payloadMsgPack)(payload)

  return new EventJournal.Entry({
    id: EventJournal.makeEntryId(),
    event: input.tag,
    primaryKey: input.alarmId,
    payload: encodedPayload,
  })
})

describe('Alarm safety-hold Reactor lane', () => {
  let dbAvailable = false

  beforeAll(async () => {
    dbAvailable = await Effect.runPromise(
      isDatabaseAvailable.pipe(Effect.provide(AlarmSafetyE2ELayer), Effect.scoped, Effect.provide(TestShardingConfig)),
    )
    if (!dbAvailable) console.log('SKIPPING: IIoT database not available')
  }, 30000)

  afterEach(async () => {
    if (!dbAvailable) return
    await Effect.runPromise(
      cleanupAlarmSafetyE2E.pipe(Effect.provide(AlarmSafetyE2ELayer), Effect.scoped, Effect.provide(TestShardingConfig)),
    )
  })

  it('applies critical alarm safety holds through targets and requires edges', async () => {
    if (!dbAvailable) return

    await Effect.runPromise(Effect.gen(function* () {
      yield* cleanupAlarmSafetyE2E
      yield* setupMachineTestHierarchy

      const deviceId = nextId('TEST-DEV-ALARM-SAFETY') as DeviceId
      const targetWorkOrderId = nextId('TEST-WO-ALARM-SAFETY-TARGETS') as WorkOrderId
      const requiredWorkOrderId = nextId('TEST-WO-ALARM-SAFETY-REQUIRES') as WorkOrderId
      const alarmId = nextId('ALM-ALARM-SAFETY') as AlarmId

      yield* insertWorkOrder(makeWorkOrder(targetWorkOrderId, 'started'))
      yield* insertWorkOrder(makeWorkOrder(requiredWorkOrderId, 'started'))

      const graph = yield* GraphClient
      const deviceEndpoint = RelationshipEndpoints.device(deviceId)
      const targetWorkOrderEndpoint = RelationshipEndpoints.workOrder(targetWorkOrderId)
      const requiredWorkOrderEndpoint = RelationshipEndpoints.workOrder(requiredWorkOrderId)
      yield* graph.upsertRelationshipNode(deviceEndpoint, { status: 'critical' })
      yield* graph.upsertRelationshipNode(targetWorkOrderEndpoint, { status: 'started' })
      yield* graph.upsertRelationshipNode(requiredWorkOrderEndpoint, { status: 'started' })
      yield* graph.upsertRelationshipEdge(RelationshipEdges.fromDescriptor(
        RELATIONSHIP_EDGE_REGISTRY.targets,
        targetWorkOrderEndpoint,
        deviceEndpoint,
        new RelationshipEdgeMetadata({ createdBy: 'reactor-alarm-safety-e2e', reason: 'target device alarm' }),
      ))
      yield* graph.upsertRelationshipEdge(RelationshipEdges.fromDescriptor(
        RELATIONSHIP_EDGE_REGISTRY.requires,
        requiredWorkOrderEndpoint,
        deviceEndpoint,
        new RelationshipEdgeMetadata({ createdBy: 'reactor-alarm-safety-e2e', reason: 'required device alarm' }),
      ))

      const entry = yield* makeAlarmEntry({ tag: 'AlarmTriggered', alarmId, deviceId })

      const reactor = yield* Reactor
      const runOption = yield* reactor.reactToJournalEntry(entry)
      expect(Option.isSome(runOption)).toBe(true)
      const run = Option.getOrThrow(runOption)
      expect(run.results.filter((result) => result.outcome === 'dispatched')).toHaveLength(2)

      const workOrders = yield* WorkOrderState
      const authority = yield* ReactorConstraintAuthority
      const targetWo = yield* workOrders.get(targetWorkOrderId)
      const requiredWo = yield* workOrders.get(requiredWorkOrderId)
      const targetConstraints = yield* authority.activeForTarget(targetWorkOrderEndpoint)
      const requiredConstraints = yield* authority.activeForTarget(requiredWorkOrderEndpoint)

      expect(targetWo.status).toBe('suspended')
      expect(requiredWo.status).toBe('suspended')
      expect(Option.getOrNull(targetWo.suspensionReason)).toBe('safety_hold')
      expect(Option.getOrNull(requiredWo.suspensionReason)).toBe('safety_hold')
      expect(targetConstraints[0]?.identity.capability).toBe(EntityCapabilityIds.SafetyHold)
      expect(requiredConstraints[0]?.identity.capability).toBe(EntityCapabilityIds.SafetyHold)
      expect(targetConstraints[0]?.identity.policyId).toBe('targets.alarm-safety-hold.holds-source')
      expect(requiredConstraints[0]?.identity.policyId).toBe('requires.alarm-safety-hold.holds-source')
      expect(targetConstraints[0]?.identity.propagationId).toBe(alarmId)
      expect(requiredConstraints[0]?.identity.propagationId).toBe(alarmId)
    }).pipe(Effect.provide(AlarmSafetyE2ELayer), Effect.scoped, Effect.provide(TestShardingConfig)))
  }, 30000)

  it('clearing one alarm retracts only its own safety hold', async () => {
    if (!dbAvailable) return

    await Effect.runPromise(Effect.gen(function* () {
      yield* cleanupAlarmSafetyE2E
      yield* setupMachineTestHierarchy

      const deviceId = nextId('TEST-DEV-ALARM-SAFETY') as DeviceId
      const workOrderId = nextId('TEST-WO-ALARM-SAFETY-ONLY-OWN') as WorkOrderId
      const firstAlarmId = nextId('ALM-ALARM-SAFETY-A') as AlarmId
      const secondAlarmId = nextId('ALM-ALARM-SAFETY-B') as AlarmId

      yield* insertWorkOrder(makeWorkOrder(workOrderId, 'started'))
      const graph = yield* GraphClient
      const deviceEndpoint = RelationshipEndpoints.device(deviceId)
      const workOrderEndpoint = RelationshipEndpoints.workOrder(workOrderId)
      yield* graph.upsertRelationshipNode(deviceEndpoint, { status: 'critical' })
      yield* graph.upsertRelationshipNode(workOrderEndpoint, { status: 'started' })
      yield* graph.upsertRelationshipEdge(RelationshipEdges.fromDescriptor(
        RELATIONSHIP_EDGE_REGISTRY.targets,
        workOrderEndpoint,
        deviceEndpoint,
        new RelationshipEdgeMetadata({ createdBy: 'reactor-alarm-safety-e2e', reason: 'two alarm safety holds' }),
      ))

      const reactor = yield* Reactor
      const firstTrigger = yield* makeAlarmEntry({ tag: 'AlarmTriggered', alarmId: firstAlarmId, deviceId })
      const secondTrigger = yield* makeAlarmEntry({ tag: 'AlarmTriggered', alarmId: secondAlarmId, deviceId })
      yield* reactor.reactToJournalEntry(firstTrigger)
      yield* reactor.reactToJournalEntry(secondTrigger)

      const authority = yield* ReactorConstraintAuthority
      const target = workOrderEndpoint
      const activeBeforeClear = yield* authority.activeForTarget(target)
      expect(activeBeforeClear.map((record) => record.identity.propagationId).sort()).toEqual([
        firstAlarmId,
        secondAlarmId,
      ].sort())

      const clearEntry = yield* makeAlarmEntry({ tag: 'AlarmCleared', alarmId: firstAlarmId, deviceId })
      const releaseRun = Option.getOrThrow(yield* reactor.reactToJournalEntry(clearEntry))
      expect(releaseRun.results[0]?.outcome).toBe('dispatched')

      const workOrders = yield* WorkOrderState
      const afterFirstClear = yield* workOrders.get(workOrderId)
      const activeAfterFirstClear = yield* authority.activeForTarget(target)
      expect(afterFirstClear.status).toBe('suspended')
      expect(activeAfterFirstClear.map((record) => record.identity.propagationId)).toEqual([secondAlarmId])
    }).pipe(Effect.provide(AlarmSafetyE2ELayer), Effect.scoped, Effect.provide(TestShardingConfig)))
  }, 30000)
})
