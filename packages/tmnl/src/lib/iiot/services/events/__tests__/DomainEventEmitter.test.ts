/**
 * DomainEventEmitter tests.
 *
 * Verifies the Phase 0 event-truth path writes concrete domain events into the
 * @effect/experimental EventJournal via the IIoT EventLog stack.
 */

import { describe, expect, it } from 'vitest'
import { DateTime, Effect, Layer, Option, Schema } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import * as EventJournal from '@effect/experimental/EventJournal'
import { DomainEventEmitter, DomainEventEmitterLive } from '../DomainEventEmitter'
import {
  IIoTDomainEventHandlersLayer,
  IIoTEventLogLayer,
} from '../../../infrastructure/eventlog-layer'
import { WorkOrder } from '../../../schemas/work-orders'
import { AlarmEvents, EquipmentStateEvents, StructuralEvents, WorkOrderEvents } from '../../../schemas/events/groups'
import type {
  AssetId,
  AlarmId,
  DeviceId,
  LineId,
  MachineId,
  PropagationId,
  WorkOrderId,
  WorkflowDefinitionId,
} from '../../../schemas/identifiers'

const makeWorkOrder = () => new WorkOrder({
  id: 'WO-EMITTER-001' as WorkOrderId,
  workflowDefinitionId: 'WF-EMITTER' as WorkflowDefinitionId,
  workflowVersion: '1',
  title: 'Emitter test work order',
  description: 'Verifies EventLog write path',
  type: 'preventive_maintenance',
  priority: 'normal',
  status: 'created',
  createdBy: 'test-operator',
  createdAt: DateTime.unsafeNow(),
  scheduledStart: Option.none(),
  dueDate: Option.none(),
  actualStart: Option.none(),
  actualEnd: Option.none(),
  parentWorkOrderId: Option.none(),
  primaryAssetId: Option.some('MCH-EMITTER-001' as AssetId),
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

const withEmitterAndJournal = <A, E, R>(
  effect: (journal: EventJournal.EventJournal.Service) => Effect.Effect<A, E, R | DomainEventEmitter>,
) =>
  Effect.gen(function* () {
    const journal = yield* EventJournal.makeMemory
    const baseLayer = Layer.mergeAll(
      Layer.succeed(EventJournal.EventJournal, journal),
      Layer.succeed(EventLog.Identity, EventLog.Identity.makeRandom()),
      IIoTDomainEventHandlersLayer,
    )
    const emitterLayer = DomainEventEmitterLive.pipe(
      Layer.provide(IIoTEventLogLayer.pipe(Layer.provide(baseLayer))),
    )

    return yield* effect(journal).pipe(Effect.provide(emitterLayer))
  })

describe('DomainEventEmitter', () => {
  it('writes WorkOrder lifecycle events to the EventJournal', async () => {
    await Effect.runPromise(withEmitterAndJournal((journal) =>
      Effect.gen(function* () {
        const emitter = yield* DomainEventEmitter

        yield* emitter.emitWorkOrderLifecycle({
          tag: 'WorkOrderCreated',
          workOrder: makeWorkOrder(),
          actor: 'test-operator',
        })

        const entries = yield* journal.entries
        expect(entries).toHaveLength(1)
        expect(entries[0]?.event).toBe('WorkOrderCreated')
      })
    ))
  })

  it('writes EquipmentStateChanged events to the EventJournal with propagation identity', async () => {
    await Effect.runPromise(withEmitterAndJournal((journal) =>
      Effect.gen(function* () {
        const emitter = yield* DomainEventEmitter
        const propagationId = 'PROP-EMITTER-EQUIPMENT-001' as PropagationId

        yield* emitter.emitEquipmentStateChanged({
          machineId: 'MCH-EMITTER-001' as MachineId,
          previousState: 'idle',
          newState: 'maintenance',
          reason: 'planned maintenance',
          triggeredBy: 'test-operator',
          propagationId,
        })

        const entries = yield* journal.entries
        expect(entries).toHaveLength(1)
        expect(entries[0]?.event).toBe('EquipmentStateChanged')

        const event = EquipmentStateEvents.events.EquipmentStateChanged
        const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entries[0]!.payload)
        expect(payload.propagationId).toBe(propagationId)
      })
    ))
  })

  it('writes WorkOrderSuspended events with local and inbound propagation identity', async () => {
    await Effect.runPromise(withEmitterAndJournal((journal) =>
      Effect.gen(function* () {
        const emitter = yield* DomainEventEmitter
        const propagationId = 'PROP-EMITTER-WO-LOCAL-001' as PropagationId
        const causedByPropagationId = 'PROP-EMITTER-EQUIPMENT-001' as PropagationId
        const workOrder = new WorkOrder({
          ...makeWorkOrder(),
          status: 'suspended',
          suspensionReason: Option.some('equipment_unavailable'),
        })

        yield* emitter.emitWorkOrderLifecycle({
          tag: 'WorkOrderSuspended',
          workOrder,
          actor: 'relationship-reactor-v1',
          propagationId,
          causedByPropagationId,
        })

        const entries = yield* journal.entries
        expect(entries).toHaveLength(1)
        expect(entries[0]?.event).toBe('WorkOrderSuspended')

        const event = WorkOrderEvents.events.WorkOrderSuspended
        const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entries[0]!.payload)
        expect(payload.propagationId).toBe(propagationId)
        expect(payload.causedByPropagationId).toBe(causedByPropagationId)
      })
    ))
  })

  it('writes WorkOrderResumed events with inbound release propagation identity', async () => {
    await Effect.runPromise(withEmitterAndJournal((journal) =>
      Effect.gen(function* () {
        const emitter = yield* DomainEventEmitter
        const causedByPropagationId = 'PROP-EMITTER-RELEASE-001' as PropagationId
        const workOrder = new WorkOrder({
          ...makeWorkOrder(),
          status: 'resumed',
        })

        yield* emitter.emitWorkOrderLifecycle({
          tag: 'WorkOrderResumed',
          workOrder,
          actor: 'relationship-reactor-v1',
          causedByPropagationId,
        })

        const entries = yield* journal.entries
        expect(entries).toHaveLength(1)
        expect(entries[0]?.event).toBe('WorkOrderResumed')

        const event = WorkOrderEvents.events.WorkOrderResumed
        const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entries[0]!.payload)
        expect(payload.causedByPropagationId).toBe(causedByPropagationId)
      })
    ))
  })

  it('writes selected structural EventGroup facts to the EventJournal', async () => {
    await Effect.runPromise(withEmitterAndJournal((journal) =>
      Effect.gen(function* () {
        const emitter = yield* DomainEventEmitter
        const payload = {
          eventId: 'EVT-STRUCTURAL-001' as EventId,
          occurredAt: DateTime.unsafeNow(),
          causedBy: 'asset-registry-test',
          entityId: 'MCH-EMITTER-STRUCTURAL-001' as AssetId,
          entityType: 'machine' as const,
          hierarchyPath: ['MCH-EMITTER-STRUCTURAL-001' as AssetId],
          correlationId: Option.none(),
          schemaVersion: 1,
          machineId: 'MCH-EMITTER-STRUCTURAL-001' as MachineId,
          lineId: 'LIN-EMITTER-001' as LineId,
          workCellId: Option.none(),
          name: 'Emitter Machine',
          machineType: 'cnc_mill',
          manufacturer: Option.none(),
          modelNumber: Option.none(),
          serialNumber: Option.none(),
          installationDate: Option.none(),
          description: Option.none(),
          initialConfig: Option.none(),
        }

        yield* emitter.emitStructuralEventStrict({ tag: 'MachineCreated', payload })

        const entries = yield* journal.entries
        expect(entries).toHaveLength(1)
        expect(entries[0]?.event).toBe('MachineCreated')

        const event = StructuralEvents.events.MachineCreated
        const decoded = yield* Schema.decodeUnknown(event.payloadMsgPack)(entries[0]!.payload)
        expect(decoded.machineId).toBe(payload.machineId)
      })
    ))
  })

  it('writes selected alarm EventGroup facts to the EventJournal', async () => {
    await Effect.runPromise(withEmitterAndJournal((journal) =>
      Effect.gen(function* () {
        const emitter = yield* DomainEventEmitter
        const payload = {
          eventId: 'EVT-ALARM-001' as EventId,
          occurredAt: DateTime.unsafeNow(),
          causedBy: 'alarm-engine-test',
          entityId: 'MCH-EMITTER-ALARM-001' as AssetId,
          entityType: 'machine' as const,
          correlationId: Option.none(),
          schemaVersion: 1,
          alarmId: 'ALM-EMITTER-001' as AlarmId,
          deviceId: 'DEV-EMITTER-001' as DeviceId,
          severity: 'critical' as const,
          alarmType: 'high_temperature' as const,
          triggerValue: 101,
          thresholdValue: Option.some(90),
          unit: Option.some('C'),
          message: Option.some('High temperature'),
          metadata: Option.none(),
        }

        yield* emitter.emitAlarmEventStrict({ tag: 'AlarmTriggered', payload })

        const entries = yield* journal.entries
        expect(entries).toHaveLength(1)
        expect(entries[0]?.event).toBe('AlarmTriggered')

        const event = AlarmEvents.events.AlarmTriggered
        const decoded = yield* Schema.decodeUnknown(event.payloadMsgPack)(entries[0]!.payload)
        expect(decoded.alarmId).toBe(payload.alarmId)
      })
    ))
  })
})
