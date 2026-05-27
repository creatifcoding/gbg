/**
 * Generic Reactor integration tests.
 *
 * Proves the Machine unavailable -> WorkOrder consistency slice can run through
 * the rule-driven path: EventObservationSpec -> RelationshipPropagationPolicy ->
 * graph expansion -> target EntityReactionContract.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { DateTime, Effect, Layer, Option } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import * as EventJournal from '@effect/experimental/EventJournal'
import { GraphClient } from '../../services/l1/GraphClient'
import { WorkOrderGraphQueries } from '../../services/l2/WorkOrderGraphQueries'
import { DomainEventEmitter, DomainEventEmitterLive } from '../../services/events'
import {
  IIoTDomainEventHandlersLayer,
  IIoTEventLogLayer,
} from '../../infrastructure/eventlog-layer'
import { WorkOrderState, WorkOrderStateInMemory } from '../../state'
import { WorkOrder, type WorkOrderStatus } from '../../schemas/work-orders'
import type {
  AssetId,
  MachineId,
  PropagationId,
  WorkOrderId,
  WorkflowDefinitionId,
} from '../../schemas/identifiers'
import { eligible, skipped } from '../../schemas/relationships'
import {
  EntityReactionRequestTemplate,
  RelationshipEdgeMetadata,
  RelationshipEndpoint,
  RelationshipPropagationPolicy,
  RequiresEquipmentUnavailableBlocksSource,
  SignalMatcher,
  TargetsMachineUnavailableBlocksSource,
} from '../../schemas/relationships/edge-types'
import {
  Reactor,
  ReactorDispatcherLive,
  ReactorLive,
  ReactorPlannerLive,
  ReactorRegistry,
  EquipmentStateChangedObservationSpec,
  makeReactorRegistry,
  type EntityReactionContract,
  type EventObservationSpec,
} from '../../services/reactor'
import {
  ObservationSignal,
  ReactorCausality,
  ReactorEventEnvelope,
  ReactorObservation,
} from '../../schemas/reactor'
import { ReactorCheckpointRepoInMemory } from '../../repos/ReactorCheckpointRepo'
import { GraphIntegrationLayer, isDatabaseAvailable } from './layer'

const TEST_MACHINE_ID = 'MCH-GENERIC-REACTOR-001' as MachineId
const TEST_EXTERNAL_ID = 'TEST-EXT-GENERIC-REACTOR-001'

const RequiresExternalUnavailableBlocksWorkOrder = new RelationshipPropagationPolicy({
  id: 'requires.external-unavailable.blocks-source' as never,
  edgeType: 'requires',
  observedEndpoint: 'target',
  accepts: new SignalMatcher({
    axis: 'external.availability',
    kind: 'condition_asserted',
    value: 'unavailable',
  }),
  requestEndpoint: 'source',
  request: new EntityReactionRequestTemplate({
    capability: 'dependency.blocked' as never,
    reason: 'external_unavailable',
    payloadDefaults: { dependencyKind: 'external' },
  }),
  effect: 'blocking',
  idempotencyStrategy: 'event_journal_entry_id',
  version: '1',
})

const ExternalDependencyChangedObservationSpec: EventObservationSpec = {
  id: 'external-dependency-changed',
  eventTag: 'ExternalDependencyChanged',
  observe: (entry) => Effect.succeed(new ReactorObservation({
    event: new ReactorEventEnvelope({
      entryId: entry.idString as never,
      tag: entry.event,
      primaryKey: entry.primaryKey,
      occurredAt: entry.createdAt,
    }),
    subject: new RelationshipEndpoint({ type: 'external', id: entry.primaryKey }),
    signals: [new ObservationSignal({
      axis: 'external.availability',
      kind: 'condition_asserted',
      value: 'unavailable',
      reason: 'external_dependency_unavailable',
    })],
    causality: new ReactorCausality({
      propagationId: `PROP-${entry.idString}` as PropagationId,
    }),
    payload: {},
  })),
}

const makeWorkOrder = (id: WorkOrderId, status: WorkOrderStatus) => new WorkOrder({
  id,
  workflowDefinitionId: 'WF-GENERIC-REACTOR' as WorkflowDefinitionId,
  workflowVersion: '1',
  title: `Generic Reactor test ${id}`,
  description: 'Rule-driven Reactor propagation fixture',
  type: 'preventive_maintenance',
  priority: 'normal',
  status,
  createdBy: 'reactor-generic-test',
  createdAt: DateTime.unsafeNow(),
  scheduledStart: Option.none(),
  dueDate: Option.none(),
  actualStart: Option.none(),
  actualEnd: Option.none(),
  parentWorkOrderId: Option.none(),
  primaryAssetId: Option.some(TEST_MACHINE_ID as unknown as AssetId),
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

const GenericReactorTestRegistryLayer = Layer.effect(
  ReactorRegistry,
  Effect.gen(function* () {
    const state = yield* WorkOrderState

    const contract: EntityReactionContract = {
      entityType: 'work_order',
      capabilities: new Map([
        ['dependency.blocked', {
          id: 'dependency.blocked',
          classify: (request) =>
            state.get(request.target.id as WorkOrderId).pipe(
              Effect.map((workOrder) => workOrder.status === 'started' || workOrder.status === 'resumed'
                ? eligible({
                  entityType: 'work_order',
                  entityId: workOrder.id,
                  currentState: workOrder.status,
                  targetState: 'suspended',
                })
                : skipped({
                  entityType: 'work_order',
                  entityId: workOrder.id,
                  currentState: workOrder.status,
                  targetState: 'suspended',
                  reason: workOrder.status === 'suspended' ? 'already_suspended' : 'terminal_state',
                })),
              Effect.catchAll(() => Effect.succeed(skipped({
                entityType: 'work_order',
                entityId: request.target.id,
                targetState: 'suspended',
                reason: 'not_found',
              }))),
            ),
          dispatch: (request) =>
            Effect.gen(function* () {
              const current = yield* state.get(request.target.id as WorkOrderId)
              yield* state.set(new WorkOrder({
                ...current,
                status: 'suspended',
                suspensionReason: Option.some('equipment_unavailable'),
              }))
            }),
        }],
      ]),
    }

    return ReactorRegistry.of(makeReactorRegistry({
      observations: [EquipmentStateChangedObservationSpec],
      propagationPolicies: [
        TargetsMachineUnavailableBlocksSource,
        RequiresEquipmentUnavailableBlocksSource,
      ],
      entities: [contract],
    }))
  }),
)

const GenericReactorTestLayer = ReactorLive.pipe(
  Layer.provide(ReactorDispatcherLive),
  Layer.provide(ReactorPlannerLive),
  Layer.provide(GenericReactorTestRegistryLayer),
  Layer.provide(ReactorCheckpointRepoInMemory),
)

const ExternalDependencyReactorTestRegistryLayer = Layer.effect(
  ReactorRegistry,
  Effect.gen(function* () {
    const state = yield* WorkOrderState

    const contract: EntityReactionContract = {
      entityType: 'work_order',
      capabilities: new Map([
        ['dependency.blocked', {
          id: 'dependency.blocked',
          classify: (request) =>
            state.get(request.target.id as WorkOrderId).pipe(
              Effect.map((workOrder) => workOrder.status === 'started' || workOrder.status === 'resumed'
                ? eligible({
                  entityType: 'work_order',
                  entityId: workOrder.id,
                  currentState: workOrder.status,
                  targetState: 'suspended',
                })
                : skipped({
                  entityType: 'work_order',
                  entityId: workOrder.id,
                  currentState: workOrder.status,
                  targetState: 'suspended',
                  reason: workOrder.status === 'suspended' ? 'already_suspended' : 'terminal_state',
                })),
              Effect.catchAll(() => Effect.succeed(skipped({
                entityType: 'work_order',
                entityId: request.target.id,
                targetState: 'suspended',
                reason: 'not_found',
              }))),
            ),
          dispatch: (request) =>
            Effect.gen(function* () {
              const current = yield* state.get(request.target.id as WorkOrderId)
              yield* state.set(new WorkOrder({
                ...current,
                status: 'suspended',
                suspensionReason: Option.some('external_dependency'),
              }))
            }),
        }],
      ]),
    }

    return ReactorRegistry.of(makeReactorRegistry({
      observations: [ExternalDependencyChangedObservationSpec],
      propagationPolicies: [RequiresExternalUnavailableBlocksWorkOrder],
      entities: [contract],
    }))
  }),
)

const ExternalDependencyReactorTestLayer = ReactorLive.pipe(
  Layer.provide(ReactorDispatcherLive),
  Layer.provide(ReactorPlannerLive),
  Layer.provide(ExternalDependencyReactorTestRegistryLayer),
  Layer.provide(ReactorCheckpointRepoInMemory),
)

describe('Generic Reactor integration', () => {
  let dbAvailable = false

  beforeAll(async () => {
    dbAvailable = await Effect.runPromise(isDatabaseAvailable.pipe(Effect.provide(GraphIntegrationLayer)))
    if (!dbAvailable) {
      console.log('SKIPPING: IIoT graph database not available')
    }
  })

  it('routes EquipmentStateChanged through observation, relationship policy, and target reaction contract', async () => {
    if (!dbAvailable) return

    const suffix = Date.now()
    const workOrderId = `TEST-WO-GENERIC-REACTOR-${suffix}` as WorkOrderId

    const program = Effect.gen(function* () {
      const graph = yield* GraphClient
      const workOrderGraph = yield* WorkOrderGraphQueries
      const state = yield* WorkOrderState
      const journal = yield* EventJournal.makeMemory

      yield* state.set(makeWorkOrder(workOrderId, 'started'))
      yield* graph.upsertRelationshipNode(
        { type: 'machine', id: TEST_MACHINE_ID },
        { name: 'Generic Reactor Test Machine' },
      )
      yield* workOrderGraph.upsertWorkOrderTargetingMachine({
        id: workOrderId,
        status: 'started',
        machineId: TEST_MACHINE_ID,
      })

      const propagationId = 'PROP-GENERIC-REACTOR-001' as PropagationId
      yield* Effect.gen(function* () {
        const emitter = yield* DomainEventEmitter
        yield* emitter.emitEquipmentStateChanged({
          machineId: TEST_MACHINE_ID,
          previousState: 'running',
          newState: 'faulted',
          reason: 'bearing fault',
          triggeredBy: 'reactor-generic-test',
          propagationId,
        })
      }).pipe(Effect.provide(makeEmitterLayer(journal)))

      const entries = yield* journal.entries

      const { first, duplicate } = yield* Effect.gen(function* () {
        const reactor = yield* Reactor
        const first = yield* reactor.reactToJournalEntry(entries[0]!)
        const duplicate = yield* reactor.reactToJournalEntry(entries[0]!)
        return { first, duplicate }
      }).pipe(Effect.provide(GenericReactorTestLayer))

      expect(Option.isSome(first)).toBe(true)
      expect(Option.isNone(duplicate)).toBe(true)

      const run = Option.getOrThrow(first)
      expect(run.plan.observation.subject).toMatchObject({ type: 'machine', id: TEST_MACHINE_ID })
      expect(run.plan.observation.signals[0]).toMatchObject({
        axis: 'equipment.availability',
        kind: 'condition_asserted',
        value: 'unavailable',
      })
      expect(run.results).toEqual(expect.arrayContaining([
        expect.objectContaining({
          target: expect.objectContaining({ type: 'work_order', id: workOrderId }),
          outcome: 'dispatched',
        }),
      ]))

      const updated = yield* state.get(workOrderId)
      expect(updated.status).toBe('suspended')
      expect(Option.getOrNull(updated.suspensionReason)).toBe('equipment_unavailable')
    }).pipe(
      Effect.ensuring(
        Effect.gen(function* () {
          const graph = yield* GraphClient
          yield* graph.executeCypher(
            `MATCH (wo:work_order {id: '${workOrderId}'}) DETACH DELETE wo`,
            '(result agtype)',
          ).pipe(Effect.ignore)
        }),
      ),
      Effect.provide(WorkOrderStateInMemory),
      Effect.provide(GraphIntegrationLayer),
    )

    await Effect.runPromise(program)
  })

  it('routes EquipmentStateChanged across production requires equipment dependency policy', async () => {
    if (!dbAvailable) return

    const suffix = Date.now()
    const workOrderId = `TEST-WO-GENERIC-REACTOR-REQ-${suffix}` as WorkOrderId

    const program = Effect.gen(function* () {
      const graph = yield* GraphClient
      const workOrderGraph = yield* WorkOrderGraphQueries
      const state = yield* WorkOrderState
      const journal = yield* EventJournal.makeMemory

      yield* state.set(makeWorkOrder(workOrderId, 'started'))
      yield* graph.upsertRelationshipNode(
        { type: 'machine', id: TEST_MACHINE_ID },
        { name: 'Generic Reactor Required Machine' },
      )
      yield* graph.upsertRelationshipNode(
        { type: 'work_order', id: workOrderId },
        { status: 'started' },
      )
      yield* graph.upsertRelationshipEdge({
        source: { type: 'work_order', id: workOrderId },
        target: { type: 'machine', id: TEST_MACHINE_ID },
        edgeType: 'requires',
        metadata: new RelationshipEdgeMetadata({
          createdBy: 'reactor-generic-test',
          reason: 'required-equipment-proof',
        }),
      })

      const propagationId = `PROP-GENERIC-REACTOR-REQ-${suffix}` as PropagationId
      yield* Effect.gen(function* () {
        const emitter = yield* DomainEventEmitter
        yield* emitter.emitEquipmentStateChanged({
          machineId: TEST_MACHINE_ID,
          previousState: 'running',
          newState: 'faulted',
          reason: 'required machine fault',
          triggeredBy: 'reactor-generic-test',
          propagationId,
        })
      }).pipe(Effect.provide(makeEmitterLayer(journal)))

      const entries = yield* journal.entries

      const first = yield* Effect.gen(function* () {
        const reactor = yield* Reactor
        return yield* reactor.reactToJournalEntry(entries[0]!)
      }).pipe(Effect.provide(GenericReactorTestLayer))

      expect(Option.isSome(first)).toBe(true)
      const run = Option.getOrThrow(first)
      expect(run.results).toEqual(expect.arrayContaining([
        expect.objectContaining({
          target: expect.objectContaining({ type: 'work_order', id: workOrderId }),
          outcome: 'dispatched',
        }),
      ]))

      const updated = yield* state.get(workOrderId)
      expect(updated.status).toBe('suspended')
      expect(Option.getOrNull(updated.suspensionReason)).toBe('equipment_unavailable')
    }).pipe(
      Effect.ensuring(
        Effect.gen(function* () {
          const graph = yield* GraphClient
          yield* graph.executeCypher(
            `MATCH (wo:work_order {id: '${workOrderId}'}) DETACH DELETE wo`,
            '(result agtype)',
          ).pipe(Effect.ignore)
        }),
      ),
      Effect.provide(WorkOrderStateInMemory),
      Effect.provide(GraphIntegrationLayer),
    )

    await Effect.runPromise(program)
  })

  it('routes a second propagation policy across requires external dependency edges', async () => {
    if (!dbAvailable) return

    const suffix = Date.now()
    const workOrderId = `TEST-WO-GENERIC-REACTOR-EXT-${suffix}` as WorkOrderId
    const externalId = `${TEST_EXTERNAL_ID}-${suffix}`

    const program = Effect.gen(function* () {
      const graph = yield* GraphClient
      const workOrderGraph = yield* WorkOrderGraphQueries
      const state = yield* WorkOrderState

      yield* state.set(makeWorkOrder(workOrderId, 'started'))
      yield* graph.upsertRelationshipNode(
        { type: 'work_order', id: workOrderId },
        { status: 'started' },
      )
      yield* graph.upsertRelationshipNode(
        { type: 'external', id: externalId },
        { name: 'External dependency proof' },
      )
      yield* graph.upsertRelationshipEdge({
        source: { type: 'work_order', id: workOrderId },
        target: { type: 'external', id: externalId },
        edgeType: 'requires',
        metadata: new RelationshipEdgeMetadata({
          createdBy: 'reactor-generic-test',
          reason: 'external_dependency_proof',
          context: { proof: 'second-policy' },
        }),
      })

      const entry = new EventJournal.Entry({
        id: EventJournal.makeEntryId(),
        event: 'ExternalDependencyChanged',
        primaryKey: externalId,
        payload: new Uint8Array(),
      })

      const { first, duplicate } = yield* Effect.gen(function* () {
        const reactor = yield* Reactor
        const first = yield* reactor.reactToJournalEntry(entry)
        const duplicate = yield* reactor.reactToJournalEntry(entry)
        return { first, duplicate }
      }).pipe(Effect.provide(ExternalDependencyReactorTestLayer))

      expect(Option.isSome(first)).toBe(true)
      expect(Option.isNone(duplicate)).toBe(true)

      const run = Option.getOrThrow(first)
      expect(run.plan.observation.subject).toMatchObject({ type: 'external', id: externalId })
      expect(run.results).toEqual(expect.arrayContaining([
        expect.objectContaining({
          target: expect.objectContaining({ type: 'work_order', id: workOrderId }),
          outcome: 'dispatched',
        }),
      ]))

      const updated = yield* state.get(workOrderId)
      expect(updated.status).toBe('suspended')
      expect(Option.getOrNull(updated.suspensionReason)).toBe('external_dependency')
    }).pipe(
      Effect.ensuring(
        Effect.gen(function* () {
          const graph = yield* GraphClient
          yield* graph.executeCypher(
            `MATCH (wo:work_order {id: '${workOrderId}'}) DETACH DELETE wo`,
            '(result agtype)',
          ).pipe(Effect.ignore)
          yield* graph.executeCypher(
            `MATCH (ext:external {id: '${externalId}'}) DETACH DELETE ext`,
            '(result agtype)',
          ).pipe(Effect.ignore)
        }),
      ),
      Effect.provide(WorkOrderStateInMemory),
      Effect.provide(GraphIntegrationLayer),
    )

    await Effect.runPromise(program)
  })
})
