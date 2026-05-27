/** External/device availability guarded Reactor lane integration tests. */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DateTime, Effect, Layer, Option, Schema } from 'effect'
import { Entity, ShardingConfig } from '@effect/cluster'
import * as EventJournal from '@effect/experimental/EventJournal'
import { PgClient } from '@effect/sql-pg'
import type {
  AssetId,
  DeviceId,
  EventId,
  ExternalRefId,
  MachineId,
  WorkOrderContextId,
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
  eligible,
} from '../../schemas/relationships'
import { WorkOrderState } from '../../state'
import { WorkOrderEntity, WorkOrderEntityHandlers } from '../../entity/WorkOrderEntity'
import { WorkOrderTransitionRepo } from '../../repos'
import { GraphClient } from '../../services/l1/GraphClient'
import { ContextEvents, StructuralEvents } from '../../schemas/events/groups'
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
  ReactorExternalDeviceAvailabilityObservationSpecs,
  ReactorExternalDeviceAvailabilityPropagationPolicies,
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

const ExternalDeviceAvailabilityRegistryLayer = Layer.effect(
  ReactorRegistry,
  Effect.gen(function* () {
    const workOrders = yield* WorkOrderState
    const transitionRepo = yield* Effect.serviceOption(WorkOrderTransitionRepo)
    const constraintAuthority = yield* ReactorConstraintAuthority
    const release = yield* WorkOrderDependencyRelease
    const makeClient = yield* Entity.makeTestClient(WorkOrderEntity, WorkOrderEntityHandlerIntegrationLayer)

    const classifyDependencyBlock = (request: Parameters<EntityReactionContract['capabilities']['get']>[0] extends never ? never : any) =>
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
        [EntityCapabilityIds.DependencyBlocked, {
          id: EntityCapabilityIds.DependencyBlocked,
          classify: classifyDependencyBlock,
          dispatch: (request) => Effect.gen(function* () {
            const assertion = sqlConstraintAssertionFromRequest(request)
            if (assertion === undefined) return yield* Effect.fail(new Error('missing dependency assertion metadata'))
            yield* constraintAuthority.assert(assertion)

            const workOrderId = request.target.id as WorkOrderId
            const current = yield* workOrders.get(workOrderId)
            if (current.status === 'suspended') return current

            const client = yield* makeClient(workOrderId)
            return yield* client.WorkOrder.Suspend({
              workOrderId,
              reason: suspensionReasonFromRequest(request.payload),
              expectedResume: Option.none(),
              causedByPropagationId: Option.some(request.causality.propagationId),
              notes: Option.some(`external/device dependency blocked by ${request.source.type} ${request.source.id}`),
            })
          }),
        }],
        [EntityCapabilityIds.DependencyReleased, {
          id: EntityCapabilityIds.DependencyReleased,
          classify: release.classify,
          dispatch: release.dispatch,
        }],
      ]),
    }

    return ReactorRegistry.of(makeReactorRegistry({
      observations: ReactorExternalDeviceAvailabilityObservationSpecs,
      propagationPolicies: ReactorExternalDeviceAvailabilityPropagationPolicies,
      entities: [contract],
    }))
  }),
)

const ExternalDeviceAvailabilityReactorLayer = ReactorLive.pipe(
  Layer.provide(ReactorDispatcherLive.pipe(Layer.provide(ReactorAdmissionControlLive))),
  Layer.provide(ReactorPlannerLive),
  Layer.provide(ExternalDeviceAvailabilityRegistryLayer),
  Layer.provide(ReactorAdmissionControlLive),
)

const ExternalDeviceAvailabilityDependenciesLayer = Layer.mergeAll(
  WorkOrderMachineIntegrationLayer,
  ConstraintAuthorityLayer,
  GraphIntegrationLayer,
  WorkOrderDependencyReleaseTestLayer,
)

const ExternalDeviceAvailabilityE2ELayer = Layer.merge(
  ExternalDeviceAvailabilityDependenciesLayer,
  ExternalDeviceAvailabilityReactorLayer.pipe(Layer.provide(ExternalDeviceAvailabilityDependenciesLayer)),
)

const makeWorkOrder = (id: WorkOrderId, status: WorkOrderStatus) => new WorkOrder({
  id,
  workflowDefinitionId: 'WF-REACTOR-EXTERNAL-DEVICE' as WorkflowDefinitionId,
  workflowVersion: '1',
  title: `External/device Reactor fixture ${id}`,
  description: 'External/device Reactor lane fixture',
  type: 'preventive_maintenance',
  priority: 'normal',
  status,
  createdBy: 'reactor-external-device-e2e',
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
      ${{ fixture: 'reactor-external-device-e2e' }}::jsonb
    )
  `
})

const cleanupExternalDeviceE2E = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  const graph = yield* GraphClient
  yield* sql`
    DELETE FROM iiot.reactor_constraints
    WHERE target_id LIKE 'TEST-WO-EXTDEV-%'
       OR source_id LIKE 'TEST-EXT-EXTDEV-%'
       OR source_id LIKE 'TEST-DEV-EXTDEV-%'
  `.pipe(Effect.ignore)
  yield* sql`
    DELETE FROM iiot.work_order_transitions
    WHERE work_order_id LIKE 'TEST-WO-EXTDEV-%'
  `.pipe(Effect.ignore)
  yield* sql`
    DELETE FROM iiot.work_orders
    WHERE id LIKE 'TEST-WO-EXTDEV-%'
  `.pipe(Effect.ignore)
  yield* graph.executeCypher(
    `MATCH (n) WHERE n.id STARTS WITH 'TEST-WO-EXTDEV-' OR n.id STARTS WITH 'TEST-EXT-EXTDEV-' OR n.device_id STARTS WITH 'TEST-DEV-EXTDEV-' DETACH DELETE n`,
    '(n agtype)',
  ).pipe(Effect.ignore)
  yield* cleanMachineTestData.pipe(Effect.ignore)
})

const contextPayloadBase = (workOrderId: WorkOrderId, contextId: WorkOrderContextId) => ({
  eventId: `EVT-EXTDEV-${Date.now()}-${++sequence}` as EventId,
  occurredAt: DateTime.unsafeNow(),
  causedBy: 'reactor-external-device-e2e',
  entityId: workOrderId as unknown as AssetId,
  entityType: 'machine' as const,
  correlationId: Option.none(),
  schemaVersion: 1,
  workOrderId,
  contextId,
})

const makeContextEntry = <Tag extends 'ExternalRefLinked' | 'ExternalRefUnlinked'>(input: {
  readonly tag: Tag
  readonly workOrderId: WorkOrderId
  readonly contextId: WorkOrderContextId
  readonly externalRefId: ExternalRefId
}) => Effect.gen(function* () {
  const base = contextPayloadBase(input.workOrderId, input.contextId)
  const payload = input.tag === 'ExternalRefLinked'
    ? {
      ...base,
      externalRefId: input.externalRefId,
      externalSystem: 'erp',
      externalType: 'purchase_order',
      externalIdentifier: 'PO-EXTDEV-001',
      linkUrl: Option.none(),
      metadata: Option.none(),
    }
    : {
      ...base,
      externalRefId: input.externalRefId,
      reason: 'external_deleted' as const,
      notes: Option.none(),
    }

  const event = ContextEvents.events[input.tag] as { payloadMsgPack: Schema.Schema<unknown, Uint8Array> }
  const encodedPayload = yield* Schema.encode(event.payloadMsgPack)(payload)
  return new EventJournal.Entry({
    id: EventJournal.makeEntryId(),
    event: input.tag,
    primaryKey: input.contextId,
    payload: encodedPayload,
  })
})

const makeDeviceDecommissionedEntry = (deviceId: DeviceId, machineId: MachineId) => Effect.gen(function* () {
  const payload = {
    eventId: `EVT-EXTDEV-DEVICE-${Date.now()}-${++sequence}` as EventId,
    occurredAt: DateTime.unsafeNow(),
    causedBy: 'reactor-external-device-e2e',
    entityId: deviceId as unknown as AssetId,
    entityType: 'device' as const,
    hierarchyPath: [deviceId],
    correlationId: Option.none(),
    schemaVersion: 1,
    deviceId,
    machineId,
    reason: 'device retired',
    effectiveDate: DateTime.unsafeNow(),
    totalOperationHours: Option.none(),
    notes: Option.none(),
  }
  const event = StructuralEvents.events.DeviceDecommissioned as { payloadMsgPack: Schema.Schema<unknown, Uint8Array> }
  const encodedPayload = yield* Schema.encode(event.payloadMsgPack)(payload)
  return new EventJournal.Entry({
    id: EventJournal.makeEntryId(),
    event: 'DeviceDecommissioned',
    primaryKey: deviceId,
    payload: encodedPayload,
  })
})

describe('External/device availability Reactor lane', () => {
  let dbAvailable = false

  beforeAll(async () => {
    dbAvailable = await Effect.runPromise(
      isDatabaseAvailable.pipe(Effect.provide(ExternalDeviceAvailabilityE2ELayer), Effect.scoped, Effect.provide(TestShardingConfig)),
    )
    if (!dbAvailable) console.log('SKIPPING: IIoT database not available')
  }, 30000)

  afterEach(async () => {
    if (!dbAvailable) return
    await Effect.runPromise(
      cleanupExternalDeviceE2E.pipe(Effect.provide(ExternalDeviceAvailabilityE2ELayer), Effect.scoped, Effect.provide(TestShardingConfig)),
    )
  })

  it('blocks on external unlink after projection closes the edge, then releases on relink', async () => {
    if (!dbAvailable) return

    await Effect.runPromise(Effect.gen(function* () {
      yield* cleanupExternalDeviceE2E
      yield* setupMachineTestHierarchy

      const workOrderId = nextId('TEST-WO-EXTDEV-EXTERNAL') as WorkOrderId
      const externalRefId = nextId('TEST-EXT-EXTDEV') as ExternalRefId
      const contextId = nextId('TEST-CTX-EXTDEV') as WorkOrderContextId
      const workOrderEndpoint = RelationshipEndpoints.workOrder(workOrderId)
      const externalEndpoint = RelationshipEndpoints.external(externalRefId)

      yield* insertWorkOrder(makeWorkOrder(workOrderId, 'started'))

      const graph = yield* GraphClient
      yield* graph.upsertRelationshipNode(workOrderEndpoint, { status: 'started' })
      yield* graph.upsertRelationshipNode(externalEndpoint, { external_kind: 'reference' })
      yield* graph.upsertRelationshipEdge(RelationshipEdges.fromDescriptor(
        RELATIONSHIP_EDGE_REGISTRY.requires,
        workOrderEndpoint,
        externalEndpoint,
        new RelationshipEdgeMetadata({ createdBy: 'reactor-external-device-e2e', reason: 'required external reference' }),
      ))

      const unlinkEntry = yield* makeContextEntry({ tag: 'ExternalRefUnlinked', workOrderId, contextId, externalRefId })
      yield* graph.softDeleteRelationshipEdge({
        source: workOrderEndpoint,
        target: externalEndpoint,
        edgeType: 'requires',
        reason: 'external_deleted',
      })

      const reactor = yield* Reactor
      const blockRun = Option.getOrThrow(yield* reactor.reactToJournalEntry(unlinkEntry))
      expect(blockRun.results.filter((result) => result.outcome === 'dispatched')).toHaveLength(1)

      const workOrders = yield* WorkOrderState
      const authority = yield* ReactorConstraintAuthority
      const blocked = yield* workOrders.get(workOrderId)
      const activeAfterUnlink = yield* authority.activeForTarget(workOrderEndpoint)

      expect(blocked.status).toBe('suspended')
      expect(Option.getOrNull(blocked.suspensionReason)).toBe('external_dependency')
      expect(activeAfterUnlink).toHaveLength(1)
      expect(activeAfterUnlink[0]?.identity.policyId).toBe('requires.external-unavailable.blocks-source')
      expect(activeAfterUnlink[0]?.identity.propagationId).toBe(externalRefId)

      yield* graph.upsertRelationshipEdge(RelationshipEdges.fromDescriptor(
        RELATIONSHIP_EDGE_REGISTRY.requires,
        workOrderEndpoint,
        externalEndpoint,
        new RelationshipEdgeMetadata({ createdBy: 'reactor-external-device-e2e', reason: 'required external reference restored' }),
      ))
      const linkEntry = yield* makeContextEntry({ tag: 'ExternalRefLinked', workOrderId, contextId, externalRefId })
      const releaseRun = Option.getOrThrow(yield* reactor.reactToJournalEntry(linkEntry))
      expect(releaseRun.results[0]?.outcome).toBe('dispatched')

      const resumed = yield* workOrders.get(workOrderId)
      const activeAfterRelink = yield* authority.activeForTarget(workOrderEndpoint)
      expect(activeAfterRelink).toHaveLength(0)
      expect(resumed.status).toBe('resumed')
    }).pipe(Effect.provide(ExternalDeviceAvailabilityE2ELayer), Effect.scoped, Effect.provide(TestShardingConfig)))
  }, 30000)

  it('blocks required WorkOrders when a required device is decommissioned', async () => {
    if (!dbAvailable) return

    await Effect.runPromise(Effect.gen(function* () {
      yield* cleanupExternalDeviceE2E
      yield* setupMachineTestHierarchy

      const workOrderId = nextId('TEST-WO-EXTDEV-DEVICE') as WorkOrderId
      const deviceId = nextId('TEST-DEV-EXTDEV') as DeviceId
      const machineId = nextId('TEST-MCH-EXTDEV') as MachineId
      const workOrderEndpoint = RelationshipEndpoints.workOrder(workOrderId)
      const deviceEndpoint = RelationshipEndpoints.device(deviceId)

      yield* insertWorkOrder(makeWorkOrder(workOrderId, 'started'))

      const graph = yield* GraphClient
      yield* graph.upsertRelationshipNode(workOrderEndpoint, { status: 'started' })
      yield* graph.upsertRelationshipNode(deviceEndpoint, { status: 'commissioned' })
      yield* graph.upsertRelationshipEdge(RelationshipEdges.fromDescriptor(
        RELATIONSHIP_EDGE_REGISTRY.requires,
        workOrderEndpoint,
        deviceEndpoint,
        new RelationshipEdgeMetadata({ createdBy: 'reactor-external-device-e2e', reason: 'required device' }),
      ))

      const reactor = yield* Reactor
      const entry = yield* makeDeviceDecommissionedEntry(deviceId, machineId)
      const run = Option.getOrThrow(yield* reactor.reactToJournalEntry(entry))
      expect(run.results.filter((result) => result.outcome === 'dispatched')).toHaveLength(1)

      const workOrders = yield* WorkOrderState
      const authority = yield* ReactorConstraintAuthority
      const blocked = yield* workOrders.get(workOrderId)
      const active = yield* authority.activeForTarget(workOrderEndpoint)

      expect(blocked.status).toBe('suspended')
      expect(Option.getOrNull(blocked.suspensionReason)).toBe('equipment_unavailable')
      expect(active).toHaveLength(1)
      expect(active[0]?.identity.policyId).toBe('requires.device-unavailable.blocks-source')
      expect(active[0]?.identity.source).toMatchObject({ type: 'device', id: deviceId })
      expect(active[0]?.identity.propagationId).toBe(deviceId)
    }).pipe(Effect.provide(ExternalDeviceAvailabilityE2ELayer), Effect.scoped, Effect.provide(TestShardingConfig)))
  }, 30000)
})
