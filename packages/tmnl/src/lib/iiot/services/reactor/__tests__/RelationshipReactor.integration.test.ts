/**
 * RelationshipReactor integration tests.
 *
 * Uses real Apache AGE graph queries for relationship discovery and an in-memory
 * dispatcher port to prove Reactor v1 pre-filter + dispatch behavior without
 * requiring a cluster runtime in the test process.
 */

import { describe, expect, beforeAll, it } from 'vitest'
import { DateTime, Effect, Layer, Option } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import * as EventJournal from '@effect/experimental/EventJournal'
import { GraphClient } from '../../l1/GraphClient'
import { WorkOrderGraphQueries } from '../../l2/WorkOrderGraphQueries'
import {
  RelationshipReactor,
  RelationshipReactorLive,
  WorkOrderReactorDispatcher,
} from '../RelationshipReactor'
import { EquipmentStateChange } from '../../../realtime/event-distribution'
import { DomainEventEmitter, DomainEventEmitterLive } from '../../events'
import {
  IIoTDomainEventHandlersLayer,
  IIoTEventLogLayer,
} from '../../../infrastructure/eventlog-layer'
import { WorkOrderState, WorkOrderStateInMemory } from '../../../state'
import { WorkOrder, type WorkOrderStatus } from '../../../schemas/work-orders'
import type {
  AssetId,
  MachineId,
  PropagationId,
  WorkOrderId,
  WorkflowDefinitionId,
} from '../../../schemas/identifiers'
import { GraphIntegrationLayer, isDatabaseAvailable } from '../../../__tests__/integration/layer'
import { ReactorCheckpointRepoInMemory } from '../../../repos/ReactorCheckpointRepo'

const TEST_MACHINE_ID = 'MCH-001' as MachineId

const makeWorkOrder = (id: WorkOrderId, status: WorkOrderStatus) => new WorkOrder({
  id,
  workflowDefinitionId: 'WF-REACTOR' as WorkflowDefinitionId,
  workflowVersion: '1',
  title: `Reactor test ${id}`,
  description: 'Graph-backed Reactor vertical slice fixture',
  type: 'preventive_maintenance',
  priority: 'normal',
  status,
  createdBy: 'reactor-test',
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

const makeInMemoryDispatcher = (
  state: WorkOrderState.Service,
  captured: Array<{ workOrderId: WorkOrderId; propagationId?: PropagationId }> = [],
) =>
  WorkOrderReactorDispatcher.of({
    suspendForEquipmentUnavailable: ({ workOrderId, propagationId }) =>
      Effect.gen(function* () {
        captured.push({ workOrderId, propagationId })
        const current = yield* state.get(workOrderId)
        const suspended = new WorkOrder({
          ...current,
          status: 'suspended',
          suspensionReason: Option.some('equipment_unavailable'),
        })
        yield* state.set(suspended)
        return suspended
      }),
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

describe('RelationshipReactor integration', () => {
  let dbAvailable = false

  beforeAll(async () => {
    dbAvailable = await Effect.runPromise(isDatabaseAvailable.pipe(Effect.provide(GraphIntegrationLayer)))
    if (!dbAvailable) {
      console.log('SKIPPING: IIoT graph database not available')
    }
  })

  it('reacts to durable EquipmentStateChanged journal entries', async () => {
    if (!dbAvailable) return

    const suffix = Date.now()
    const workOrderId = `TEST-WO-REACTOR-JOURNAL-${suffix}` as WorkOrderId

    const program = Effect.gen(function* () {
      const workOrderGraph = yield* WorkOrderGraphQueries
      const state = yield* WorkOrderState
      const journal = yield* EventJournal.makeMemory

      yield* state.set(makeWorkOrder(workOrderId, 'started'))
      yield* workOrderGraph.upsertWorkOrderTargetingMachine({
        id: workOrderId,
        status: 'started',
        machineId: TEST_MACHINE_ID,
      })

      const propagationId = 'PROP-REACTOR-JOURNAL-001' as PropagationId
      yield* Effect.gen(function* () {
        const emitter = yield* DomainEventEmitter
        yield* emitter.emitEquipmentStateChanged({
          machineId: TEST_MACHINE_ID,
          previousState: 'running',
          newState: 'maintenance',
          reason: 'scheduled maintenance',
          triggeredBy: 'reactor-test',
          propagationId,
        })
      }).pipe(Effect.provide(makeEmitterLayer(journal)))

      const entries = yield* journal.entries
      const capturedDispatches: Array<{ workOrderId: WorkOrderId; propagationId?: PropagationId }> = []
      const dispatcher = makeInMemoryDispatcher(state, capturedDispatches)

      const reactorProgram = Effect.gen(function* () {
        const reactor = yield* RelationshipReactor
        const first = yield* reactor.reactToJournalEntry(entries[0])
        const duplicate = yield* reactor.reactToJournalEntry(entries[0])
        return { first, duplicate }
      }).pipe(
        Effect.provide(RelationshipReactorLive),
        Effect.provideService(WorkOrderReactorDispatcher, dispatcher),
        Effect.provide(ReactorCheckpointRepoInMemory),
      )

      const { first, duplicate } = yield* reactorProgram

      expect(Option.isSome(first)).toBe(true)
      expect(Option.isNone(duplicate)).toBe(true)
      expect(Option.getOrThrow(first).plan.propagationId).toBe(propagationId)
      expect(capturedDispatches).toEqual([{ workOrderId, propagationId }])
      const updated = yield* state.get(workOrderId)
      expect(updated.status).toBe('suspended')
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

  it('suspends active graph-related WorkOrders and classifies terminal targets as skips', async () => {
    if (!dbAvailable) return

    const suffix = Date.now()
    const startedId = `TEST-WO-REACTOR-STARTED-${suffix}` as WorkOrderId
    const resumedId = `TEST-WO-REACTOR-RESUMED-${suffix}` as WorkOrderId
    const completedId = `TEST-WO-REACTOR-COMPLETED-${suffix}` as WorkOrderId
    const ids = [startedId, resumedId, completedId]

    const program = Effect.gen(function* () {
      const workOrderGraph = yield* WorkOrderGraphQueries
      const state = yield* WorkOrderState

      yield* state.set(makeWorkOrder(startedId, 'started'))
      yield* state.set(makeWorkOrder(resumedId, 'resumed'))
      yield* state.set(makeWorkOrder(completedId, 'completed'))

      for (const id of ids) {
        yield* workOrderGraph.upsertWorkOrderTargetingMachine({
          id,
          status: id === completedId ? 'completed' : 'started',
          machineId: TEST_MACHINE_ID,
        })
      }

      const dispatcher = makeInMemoryDispatcher(state)

      const warmPropagationId = 'PROP-REACTOR-WARM-001' as PropagationId
      const resultOption = yield* Effect.gen(function* () {
        const reactor = yield* RelationshipReactor
        return yield* reactor.reactToEquipmentStateChange(new EquipmentStateChange({
          equipmentId: TEST_MACHINE_ID,
          previousState: 'running',
          newState: 'planned_downtime',
          timestamp: new Date().toISOString(),
          propagationId: warmPropagationId,
        }))
      }).pipe(
        Effect.provide(RelationshipReactorLive),
        Effect.provideService(WorkOrderReactorDispatcher, dispatcher),
      )

      expect(Option.isSome(resultOption)).toBe(true)
      const result = Option.getOrThrow(resultOption)

      const ignored = yield* Effect.gen(function* () {
        const reactor = yield* RelationshipReactor
        return yield* reactor.reactToEquipmentStateChange(new EquipmentStateChange({
          equipmentId: TEST_MACHINE_ID,
          previousState: 'idle',
          newState: 'running',
          timestamp: new Date().toISOString(),
        }))
      }).pipe(
        Effect.provide(RelationshipReactorLive),
        Effect.provideService(WorkOrderReactorDispatcher, dispatcher),
      )

      const started = yield* state.get(startedId)
      const resumed = yield* state.get(resumedId)
      const completed = yield* state.get(completedId)

      expect(started.status).toBe('suspended')
      expect(Option.getOrNull(started.suspensionReason)).toBe('equipment_unavailable')
      expect(resumed.status).toBe('suspended')
      expect(completed.status).toBe('completed')

      expect(Option.isNone(ignored)).toBe(true)
      expect(result.plan.propagationId).toBe(warmPropagationId)

      const relevantResults = result.results.filter((r) => ids.includes(r.workOrderId))
      expect(relevantResults.filter((r) => r.outcome === 'suspended')).toHaveLength(2)
      expect(relevantResults.find((r) => r.workOrderId === completedId)?.outcome).toBe('skipped')
      expect(relevantResults.find((r) => r.workOrderId === completedId)?.skipReason).toBe('terminal_state')
    }).pipe(
      Effect.ensuring(
        Effect.gen(function* () {
          const graph = yield* GraphClient
          for (const id of ids) {
            yield* graph.executeCypher(
              `MATCH (wo:work_order {id: '${id}'}) DETACH DELETE wo`,
              '(result agtype)',
            ).pipe(Effect.ignore)
          }
        }),
      ),
      Effect.provide(WorkOrderStateInMemory),
      Effect.provide(GraphIntegrationLayer),
    )

    await Effect.runPromise(program)
  })
})
