/**
 * DomainEventEmitter graph projection integration test.
 *
 * Proves the durable WorkOrderCreated EventLog path also projects the graph
 * anchor/target edge that Reactor v1 queries.
 */

import { describe, expect, beforeAll, it } from 'vitest'
import { DateTime, Effect, Layer, Option } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import * as EventJournal from '@effect/experimental/EventJournal'
import { DomainEventEmitter, DomainEventEmitterLive } from '../DomainEventEmitter'
import {
  IIoTDomainEventHandlersLayer,
  IIoTEventLogLayer,
} from '../../../infrastructure/eventlog-layer'
import { GraphClient } from '../../l1/GraphClient'
import { WorkOrder } from '../../../schemas/work-orders'
import type {
  AssetId,
  MachineId,
  WorkOrderId,
  WorkflowDefinitionId,
} from '../../../schemas/identifiers'
import { GraphIntegrationLayer, isDatabaseAvailable } from '../../../__tests__/integration/layer'

const TEST_MACHINE_ID = 'MCH-001' as MachineId

const makeWorkOrder = (id: WorkOrderId) => new WorkOrder({
  id,
  workflowDefinitionId: 'WF-GRAPH-PROJECTION' as WorkflowDefinitionId,
  workflowVersion: '1',
  title: 'Graph projection work order',
  description: 'EventLog handler should project this WorkOrder into AGE',
  type: 'preventive_maintenance',
  priority: 'normal',
  status: 'created',
  createdBy: 'projection-test',
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

describe('DomainEventEmitter graph projection integration', () => {
  let dbAvailable = false

  beforeAll(async () => {
    dbAvailable = await Effect.runPromise(isDatabaseAvailable.pipe(Effect.provide(GraphIntegrationLayer)))
    if (!dbAvailable) {
      console.log('SKIPPING: IIoT graph database not available')
    }
  })

  it('projects WorkOrderCreated into work_order -[:targets]-> machine graph edge', async () => {
    if (!dbAvailable) return

    const workOrderId = `TEST-WO-GRAPH-PROJECTION-${Date.now()}` as WorkOrderId

    const program = Effect.gen(function* () {
      const journal = yield* EventJournal.makeMemory
      const graph = yield* GraphClient

      yield* Effect.gen(function* () {
        const emitter = yield* DomainEventEmitter
        yield* emitter.emitWorkOrderLifecycle({
          tag: 'WorkOrderCreated',
          workOrder: makeWorkOrder(workOrderId),
          actor: 'projection-test',
        })
      }).pipe(Effect.provide(makeEmitterLayer(journal)))

      const ids = yield* graph.getWorkOrderIdsTargetingMachine(TEST_MACHINE_ID)
      expect(ids).toContain(workOrderId)
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
      Effect.provide(GraphIntegrationLayer),
    )

    await Effect.runPromise(program)
  })
})
