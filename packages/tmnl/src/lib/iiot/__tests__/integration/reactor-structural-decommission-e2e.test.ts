/** Structural decommission guarded Reactor lane integration tests. */

import { beforeAll, afterEach, describe, expect, it } from 'vitest'
import { DateTime, Effect, Layer, Option, Schema } from 'effect'
import { Entity, ShardingConfig } from '@effect/cluster'
import * as EventJournal from '@effect/experimental/EventJournal'
import { PgClient } from '@effect/sql-pg'
import type {
  AssetId,
  EventId,
  LineId,
  MachineId,
  PlantId,
  WorkOrderId,
  WorkflowDefinitionId,
} from '../../schemas/identifiers'
import { WorkOrder, type WorkOrderStatus } from '../../schemas/work-orders'
import {
  EntityCapabilityIds,
  RELATIONSHIP_EDGE_REGISTRY,
  RelationshipEdgeMetadata,
  RelationshipEdges,
  RelationshipEndpoints,
} from '../../schemas/relationships'
import { StructuralEvents } from '../../schemas/events/groups'
import { WorkOrderState } from '../../state'
import { WorkOrderEntity, WorkOrderEntityHandlers } from '../../entity/WorkOrderEntity'
import { WorkOrderTransitionRepo } from '../../repos'
import { GraphClient } from '../../services/l1/GraphClient'
import {
  Reactor,
  ReactorAdmissionControlLive,
  ReactorConstraintAuthority,
  ReactorConstraintAuthoritySqlLive,
  ReactorDispatcherLive,
  ReactorLive,
  ReactorPlannerLive,
  ReactorRegistry,
  makeReactorRegistry,
  makeStructuralLifecycleInheritedContracts,
  type EntityReactionContract,
} from '../../services/reactor'
import {
  ReactorStructuralDecommissionObservationSpecs,
  ReactorStructuralDecommissionPropagationPolicies,
} from '../../services/reactor/layers'
import {
  sqlConstraintAssertionFromRequest,
  suspensionReasonFromRequest,
} from '../../services/reactor/contracts/work-order'
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

const StructuralDecommissionRegistryLayer = Layer.effect(
  ReactorRegistry,
  Effect.gen(function* () {
    const workOrders = yield* WorkOrderState
    const transitionRepo = yield* Effect.serviceOption(WorkOrderTransitionRepo)
    const constraintAuthority = yield* ReactorConstraintAuthority
    const makeClient = yield* Entity.makeTestClient(WorkOrderEntity, WorkOrderEntityHandlerIntegrationLayer)

    const workOrderContract: EntityReactionContract = {
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
                notes: Option.some(`structural decommission Reactor block from ${request.source.type}:${request.source.id}`),
              })
            }),
        }],
      ]),
    }

    return ReactorRegistry.of(makeReactorRegistry({
      observations: ReactorStructuralDecommissionObservationSpecs,
      propagationPolicies: ReactorStructuralDecommissionPropagationPolicies,
      entities: [workOrderContract, ...makeStructuralLifecycleInheritedContracts()],
    }))
  }),
)

const StructuralDecommissionReactorLayer = ReactorLive.pipe(
  Layer.provide(ReactorDispatcherLive.pipe(Layer.provide(ReactorAdmissionControlLive))),
  Layer.provide(ReactorPlannerLive),
  Layer.provide(StructuralDecommissionRegistryLayer),
  Layer.provide(ReactorAdmissionControlLive),
)

const StructuralDecommissionE2ELayer = Layer.mergeAll(
  WorkOrderMachineIntegrationLayer,
  ConstraintAuthorityLayer,
  GraphIntegrationLayer,
  StructuralDecommissionReactorLayer.pipe(Layer.provide(Layer.mergeAll(
    WorkOrderMachineIntegrationLayer,
    ConstraintAuthorityLayer,
    GraphIntegrationLayer,
  ))),
)

const makeWorkOrder = (id: WorkOrderId, status: WorkOrderStatus) => new WorkOrder({
  id,
  workflowDefinitionId: 'WF-REACTOR-STRUCTURAL-DECOMMISSION' as WorkflowDefinitionId,
  workflowVersion: '1',
  title: `Structural decommission Reactor fixture ${id}`,
  description: 'Structural decommission Reactor lane fixture',
  type: 'preventive_maintenance',
  priority: 'normal',
  status,
  createdBy: 'reactor-structural-decommission-e2e',
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
      ${{ fixture: 'reactor-structural-decommission-e2e' }}::jsonb
    )
  `
})

const cleanupStructuralDecommissionE2E = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`
    DELETE FROM iiot.reactor_constraints
    WHERE target_id LIKE 'TEST-WO-STRUCTURAL-%'
       OR source_id LIKE 'TEST-%STRUCTURAL-%'
  `.pipe(Effect.ignore)
  yield* sql`
    DELETE FROM iiot.work_order_transitions
    WHERE work_order_id LIKE 'TEST-WO-STRUCTURAL-%'
  `.pipe(Effect.ignore)
  yield* sql`
    DELETE FROM iiot.work_orders
    WHERE id LIKE 'TEST-WO-STRUCTURAL-%'
  `.pipe(Effect.ignore)
  yield* cleanMachineTestData.pipe(Effect.ignore)
})

const structuralBase = (input: {
  readonly eventId: EventId
  readonly entityId: AssetId
  readonly entityType: 'plant' | 'machine'
}) => ({
  eventId: input.eventId,
  occurredAt: DateTime.unsafeNow(),
  causedBy: 'reactor-structural-decommission-e2e',
  entityId: input.entityId,
  entityType: input.entityType,
  hierarchyPath: [input.entityId],
  correlationId: Option.none(),
  schemaVersion: 1,
})

const makeStructuralEntry = (input:
  | { readonly tag: 'PlantDecommissioned'; readonly plantId: PlantId }
  | { readonly tag: 'MachineDecommissioned'; readonly machineId: MachineId; readonly lineId: LineId }
) => Effect.gen(function* () {
  const payload = input.tag === 'PlantDecommissioned'
    ? {
      ...structuralBase({
        eventId: `EVT-${input.plantId}` as EventId,
        entityId: input.plantId as unknown as AssetId,
        entityType: 'plant',
      }),
      plantId: input.plantId,
      reason: 'structural decommission test',
      effectiveDate: DateTime.unsafeNow(),
      notes: Option.some('plant decommission cascade fixture'),
    }
    : {
      ...structuralBase({
        eventId: `EVT-${input.machineId}` as EventId,
        entityId: input.machineId as unknown as AssetId,
        entityType: 'machine',
      }),
      machineId: input.machineId,
      lineId: input.lineId,
      reason: 'structural decommission test',
      effectiveDate: DateTime.unsafeNow(),
      totalOperationalHours: Option.none(),
      notes: Option.some('machine decommission block fixture'),
    }

  const event = StructuralEvents.events[input.tag] as { payloadMsgPack: Schema.Schema<unknown, Uint8Array> }
  const encodedPayload = yield* Schema.encode(event.payloadMsgPack)(payload)

  return new EventJournal.Entry({
    id: EventJournal.makeEntryId(),
    event: input.tag,
    primaryKey: input.tag === 'PlantDecommissioned' ? input.plantId : input.machineId,
    payload: encodedPayload,
  })
})

describe('Structural decommission Reactor lane', () => {
  let dbAvailable = false

  beforeAll(async () => {
    dbAvailable = await Effect.runPromise(
      isDatabaseAvailable.pipe(Effect.provide(StructuralDecommissionE2ELayer), Effect.scoped, Effect.provide(TestShardingConfig)),
    )
    if (!dbAvailable) console.log('SKIPPING: IIoT database not available')
  }, 30000)

  afterEach(async () => {
    if (!dbAvailable) return
    await Effect.runPromise(
      cleanupStructuralDecommissionE2E.pipe(Effect.provide(StructuralDecommissionE2ELayer), Effect.scoped, Effect.provide(TestShardingConfig)),
    )
  })

  it('routes contains cascade only to direct children in deterministic order', async () => {
    if (!dbAvailable) return

    await Effect.runPromise(Effect.gen(function* () {
      yield* cleanupStructuralDecommissionE2E
      yield* setupMachineTestHierarchy

      const plantId = nextId('TEST-PLANT-STRUCTURAL') as PlantId
      const firstLineId = nextId('TEST-LINE-STRUCTURAL-A') as LineId
      const secondLineId = nextId('TEST-LINE-STRUCTURAL-B') as LineId
      const nestedMachineId = nextId('TEST-MACHINE-STRUCTURAL-NESTED') as MachineId

      const plant = RelationshipEndpoints.plant(plantId)
      const firstLine = RelationshipEndpoints.line(firstLineId)
      const secondLine = RelationshipEndpoints.line(secondLineId)
      const nestedMachine = RelationshipEndpoints.machine(nestedMachineId)

      const graph = yield* GraphClient
      yield* graph.upsertRelationshipNode(plant, { status: 'decommissioning' })
      yield* graph.upsertRelationshipNode(firstLine, { status: 'active' })
      yield* graph.upsertRelationshipNode(secondLine, { status: 'active' })
      yield* graph.upsertRelationshipNode(nestedMachine, { status: 'active' })
      yield* graph.upsertRelationshipEdge(RelationshipEdges.fromDescriptor(
        RELATIONSHIP_EDGE_REGISTRY.contains,
        plant,
        secondLine,
        new RelationshipEdgeMetadata({ createdBy: 'reactor-structural-decommission-e2e', reason: 'plant contains line B' }),
      ))
      yield* graph.upsertRelationshipEdge(RelationshipEdges.fromDescriptor(
        RELATIONSHIP_EDGE_REGISTRY.contains,
        plant,
        firstLine,
        new RelationshipEdgeMetadata({ createdBy: 'reactor-structural-decommission-e2e', reason: 'plant contains line A' }),
      ))
      yield* graph.upsertRelationshipEdge(RelationshipEdges.fromDescriptor(
        RELATIONSHIP_EDGE_REGISTRY.contains,
        firstLine,
        nestedMachine,
        new RelationshipEdgeMetadata({ createdBy: 'reactor-structural-decommission-e2e', reason: 'line contains nested machine' }),
      ))

      const entry = yield* makeStructuralEntry({ tag: 'PlantDecommissioned', plantId })
      const reactor = yield* Reactor
      const run = Option.getOrThrow(yield* reactor.reactToJournalEntry(entry))

      expect(run.results).toHaveLength(2)
      expect(run.results.map((result) => result.target.id)).toEqual([firstLineId, secondLineId])
      expect(run.results.every((result) => result.request.capability === EntityCapabilityIds.LifecycleInherited)).toBe(true)
      expect(run.results.every((result) => result.outcome === 'dispatched')).toBe(true)
    }).pipe(Effect.provide(StructuralDecommissionE2ELayer), Effect.scoped, Effect.provide(TestShardingConfig)))
  }, 30000)

  it('blocks WorkOrders targeting or requiring a decommissioned machine', async () => {
    if (!dbAvailable) return

    await Effect.runPromise(Effect.gen(function* () {
      yield* cleanupStructuralDecommissionE2E
      yield* setupMachineTestHierarchy

      const lineId = nextId('TEST-LINE-STRUCTURAL') as LineId
      const machineId = nextId('TEST-MACHINE-STRUCTURAL') as MachineId
      const targetWorkOrderId = nextId('TEST-WO-STRUCTURAL-TARGETS') as WorkOrderId
      const requiredWorkOrderId = nextId('TEST-WO-STRUCTURAL-REQUIRES') as WorkOrderId

      yield* insertWorkOrder(makeWorkOrder(targetWorkOrderId, 'started'))
      yield* insertWorkOrder(makeWorkOrder(requiredWorkOrderId, 'started'))

      const machine = RelationshipEndpoints.machine(machineId)
      const targetWorkOrder = RelationshipEndpoints.workOrder(targetWorkOrderId)
      const requiredWorkOrder = RelationshipEndpoints.workOrder(requiredWorkOrderId)
      const graph = yield* GraphClient
      yield* graph.upsertRelationshipNode(machine, { status: 'decommissioned' })
      yield* graph.upsertRelationshipNode(targetWorkOrder, { status: 'started' })
      yield* graph.upsertRelationshipNode(requiredWorkOrder, { status: 'started' })
      yield* graph.upsertRelationshipEdge(RelationshipEdges.fromDescriptor(
        RELATIONSHIP_EDGE_REGISTRY.targets,
        targetWorkOrder,
        machine,
        new RelationshipEdgeMetadata({ createdBy: 'reactor-structural-decommission-e2e', reason: 'targeted machine decommissioned' }),
      ))
      yield* graph.upsertRelationshipEdge(RelationshipEdges.fromDescriptor(
        RELATIONSHIP_EDGE_REGISTRY.requires,
        requiredWorkOrder,
        machine,
        new RelationshipEdgeMetadata({ createdBy: 'reactor-structural-decommission-e2e', reason: 'required machine decommissioned' }),
      ))

      const entry = yield* makeStructuralEntry({ tag: 'MachineDecommissioned', machineId, lineId })
      const reactor = yield* Reactor
      const run = Option.getOrThrow(yield* reactor.reactToJournalEntry(entry))

      expect(run.results.filter((result) => result.outcome === 'dispatched')).toHaveLength(2)

      const workOrders = yield* WorkOrderState
      const authority = yield* ReactorConstraintAuthority
      const targetWo = yield* workOrders.get(targetWorkOrderId)
      const requiredWo = yield* workOrders.get(requiredWorkOrderId)
      const targetConstraints = yield* authority.activeForTarget(targetWorkOrder)
      const requiredConstraints = yield* authority.activeForTarget(requiredWorkOrder)

      expect(targetWo.status).toBe('suspended')
      expect(requiredWo.status).toBe('suspended')
      expect(targetConstraints[0]?.identity.policyId).toBe('targets.structural-decommission.blocks-source')
      expect(requiredConstraints[0]?.identity.policyId).toBe('requires.structural-decommission.blocks-source')
      expect(targetConstraints[0]?.identity.source.id).toBe(machineId)
      expect(requiredConstraints[0]?.identity.source.id).toBe(machineId)
    }).pipe(Effect.provide(StructuralDecommissionE2ELayer), Effect.scoped, Effect.provide(TestShardingConfig)))
  }, 30000)
})
