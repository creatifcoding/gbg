import { describe, expect, it } from 'vitest'
import { DateTime, Effect, Option, Schema } from 'effect'
import * as EventJournal from '@effect/experimental/EventJournal'
import {
  EquipmentStateChangedObservationSpec,
  FaultDetectedObservationSpec,
  MaintenanceModeEnteredObservationSpec,
  ReactiveEquipmentStateObservationSpecs,
  WorkOrderCompletedObservationSpec,
  WorkOrderDependencyObservationSpecs,
  WorkOrderResumedObservationSpec,
  WorkOrderSuspendedObservationSpec,
} from '../observations'
import { EquipmentStateEvents, WorkOrderEvents } from '../../../schemas/events/groups'
import type {
  AssetId,
  EquipmentLevel,
  EventId,
  MachineId,
  PropagationId,
  WorkOrderId,
} from '../../../schemas/identifiers'

const TEST_MACHINE_ID = 'MCH-OBSERVATION-001' as MachineId
const TEST_WORK_ORDER_ID = 'WO-OBSERVATION-001' as WorkOrderId

const basePayload = () => ({
  eventId: `EVT-OBSERVATION-${Date.now()}` as EventId,
  occurredAt: DateTime.unsafeNow(),
  causedBy: 'reactor-observation-test',
  entityId: TEST_MACHINE_ID as unknown as AssetId,
  entityType: 'machine' as EquipmentLevel,
  correlationId: Option.none(),
  schemaVersion: 1,
  machineId: TEST_MACHINE_ID,
})

const makeEntry = <Tag extends keyof typeof EquipmentStateEvents.events>(
  tag: Tag,
  payload: Record<string, unknown>,
) => Effect.gen(function* () {
  const event = EquipmentStateEvents.events[tag] as { payloadMsgPack: Schema.Schema<unknown, Uint8Array> }
  const encodedPayload = yield* Schema.encode(event.payloadMsgPack)(payload)

  return new EventJournal.Entry({
    id: EventJournal.makeEntryId(),
    event: tag,
    primaryKey: TEST_MACHINE_ID,
    payload: encodedPayload,
  })
})

const makeWorkOrderEntry = <Tag extends keyof typeof WorkOrderEvents.events>(
  tag: Tag,
  payload: Record<string, unknown>,
) => Effect.gen(function* () {
  const event = WorkOrderEvents.events[tag] as { payloadMsgPack: Schema.Schema<unknown, Uint8Array> }
  const encodedPayload = yield* Schema.encode(event.payloadMsgPack)(payload)

  return new EventJournal.Entry({
    id: EventJournal.makeEntryId(),
    event: tag,
    primaryKey: TEST_WORK_ORDER_ID,
    payload: encodedPayload,
  })
})

const makeEquipmentStateChangedEntry = (overrides?: {
  readonly newState?: 'operational' | 'degraded' | 'faulted' | 'maintenance' | 'offline'
  readonly propagationId?: PropagationId
}) => makeEntry('EquipmentStateChanged', {
  ...basePayload(),
  previousState: 'operational' as const,
  newState: overrides?.newState ?? 'faulted',
  propagationId: overrides?.propagationId,
  reason: Option.some('observation test'),
  triggeredBy: Option.some('vitest'),
})

const makeMaintenanceModeEnteredEntry = () => makeEntry('MaintenanceModeEntered', {
  ...basePayload(),
  maintenanceType: 'scheduled',
  scheduledDuration: Option.some(3_600),
  workOrderId: Option.none(),
  technician: Option.some('TECH-OBSERVATION'),
  notes: Option.some('quarterly service'),
})

const makeFaultDetectedEntry = () => makeEntry('FaultDetected', {
  ...basePayload(),
  faultCode: 'FAULT-OBSERVATION-001',
  faultSeverity: 'critical',
  faultDescription: 'Observation test fault',
  affectedComponent: Option.some('spindle'),
  sensorReadings: Option.some({ temperature: 150, threshold: 120 }),
  recommendedAction: Option.some('Inspect immediately'),
})

const baseWorkOrderPayload = () => ({
  eventId: `EVT-WO-OBSERVATION-${Date.now()}` as EventId,
  occurredAt: DateTime.unsafeNow(),
  causedBy: 'reactor-observation-test',
  entityId: TEST_MACHINE_ID as unknown as AssetId,
  entityType: 'machine' as EquipmentLevel,
  correlationId: Option.none(),
  schemaVersion: 1,
  workOrderId: TEST_WORK_ORDER_ID,
})

describe('Reactor observation adapters', () => {
  it('exports every production reactive equipment-state observation spec', () => {
    expect(ReactiveEquipmentStateObservationSpecs.map((spec) => spec.eventTag)).toEqual([
      'EquipmentStateChanged',
      'MaintenanceModeEntered',
      'FaultDetected',
    ])
  })

  it('decodes EquipmentStateChanged into machine availability unavailable signal', async () => {
    const program = Effect.gen(function* () {
      const propagationId = 'PRP-OBSERVATION-001' as PropagationId
      const entry = yield* makeEquipmentStateChangedEntry({ propagationId })
      const observation = yield* EquipmentStateChangedObservationSpec.observe(entry)

      expect(observation.event.entryId).toBe(entry.idString)
      expect(observation.event.tag).toBe('EquipmentStateChanged')
      expect(observation.subject).toMatchObject({ type: 'machine', id: TEST_MACHINE_ID })
      expect(observation.causality.propagationId).toBe(propagationId)
      expect(observation.signals).toHaveLength(1)
      expect(observation.signals[0]).toMatchObject({
        axis: 'equipment.availability',
        kind: 'condition_asserted',
        value: 'unavailable',
        previousValue: 'operational',
        reason: 'observation test',
      })
    })

    await Effect.runPromise(program)
  })

  it('maps operational EquipmentStateChanged into availability available signal', async () => {
    const program = Effect.gen(function* () {
      const entry = yield* makeEquipmentStateChangedEntry({ newState: 'operational' })
      const observation = yield* EquipmentStateChangedObservationSpec.observe(entry)

      expect(observation.signals[0]).toMatchObject({
        axis: 'equipment.availability',
        kind: 'condition_asserted',
        value: 'available',
        previousValue: 'operational',
      })
      expect(observation.causality.propagationId).toBe(entry.idString)
    })

    await Effect.runPromise(program)
  })

  it('decodes MaintenanceModeEntered into machine availability unavailable signal', async () => {
    const program = Effect.gen(function* () {
      const entry = yield* makeMaintenanceModeEnteredEntry()
      const observation = yield* MaintenanceModeEnteredObservationSpec.observe(entry)

      expect(observation.event.tag).toBe('MaintenanceModeEntered')
      expect(observation.subject).toMatchObject({ type: 'machine', id: TEST_MACHINE_ID })
      expect(observation.causality.propagationId).toBe(entry.idString)
      expect(observation.signals[0]).toMatchObject({
        axis: 'equipment.availability',
        kind: 'condition_asserted',
        value: 'unavailable',
        previousValue: 'operational',
        reason: 'maintenance:quarterly service',
      })
    })

    await Effect.runPromise(program)
  })

  it('decodes FaultDetected into machine availability unavailable signal', async () => {
    const program = Effect.gen(function* () {
      const entry = yield* makeFaultDetectedEntry()
      const observation = yield* FaultDetectedObservationSpec.observe(entry)

      expect(observation.event.tag).toBe('FaultDetected')
      expect(observation.subject).toMatchObject({ type: 'machine', id: TEST_MACHINE_ID })
      expect(observation.causality.propagationId).toBe(entry.idString)
      expect(observation.signals[0]).toMatchObject({
        axis: 'equipment.availability',
        kind: 'condition_asserted',
        value: 'unavailable',
        previousValue: 'operational',
        reason: 'critical:FAULT-OBSERVATION-001',
      })
    })

    await Effect.runPromise(program)
  })

  it('exports WorkOrder dependency observation specs for the depends_on routing contract', () => {
    expect(WorkOrderDependencyObservationSpecs.map((spec) => spec.eventTag)).toEqual([
      'WorkOrderSuspended',
      'WorkOrderFailed',
      'WorkOrderCancelled',
      'WorkOrderCompleted',
      'WorkOrderResumed',
    ])
  })

  it('decodes WorkOrderSuspended into dependency blocked signal', async () => {
    const program = Effect.gen(function* () {
      const causedByPropagationId = 'PRP-WO-OBSERVATION-BLOCKED' as PropagationId
      const entry = yield* makeWorkOrderEntry('WorkOrderSuspended', {
        ...baseWorkOrderPayload(),
        suspendedBy: 'test',
        reason: 'external_dependency',
        expectedResume: Option.none(),
        notes: Option.none(),
        causedByPropagationId,
      })
      const observation = yield* WorkOrderSuspendedObservationSpec.observe(entry)

      expect(observation.event.tag).toBe('WorkOrderSuspended')
      expect(observation.subject).toMatchObject({ type: 'work_order', id: TEST_WORK_ORDER_ID })
      expect(observation.causality.propagationId).toBe(causedByPropagationId)
      expect(observation.signals[0]).toMatchObject({
        axis: 'work_order.execution',
        kind: 'condition_asserted',
        value: 'blocked',
        reason: 'external_dependency',
      })
    })

    await Effect.runPromise(program)
  })

  it('decodes WorkOrderCompleted into dependency satisfied signal', async () => {
    const program = Effect.gen(function* () {
      const entry = yield* makeWorkOrderEntry('WorkOrderCompleted', {
        ...baseWorkOrderPayload(),
        completedBy: 'test',
        outcome: 'success',
        summary: 'completed',
        actualDurationMinutes: Option.none(),
      })
      const observation = yield* WorkOrderCompletedObservationSpec.observe(entry)

      expect(observation.subject).toMatchObject({ type: 'work_order', id: TEST_WORK_ORDER_ID })
      expect(observation.signals[0]).toMatchObject({
        axis: 'work_order.execution',
        kind: 'condition_asserted',
        value: 'satisfied',
        reason: 'success',
      })
    })

    await Effect.runPromise(program)
  })

  it('decodes WorkOrderResumed into dependency blocked retraction signal', async () => {
    const program = Effect.gen(function* () {
      const causedByPropagationId = 'PRP-WO-OBSERVATION-RELEASED' as PropagationId
      const entry = yield* makeWorkOrderEntry('WorkOrderResumed', {
        ...baseWorkOrderPayload(),
        resumedBy: 'test',
        notes: Option.none(),
        causedByPropagationId,
      })
      const observation = yield* WorkOrderResumedObservationSpec.observe(entry)

      expect(observation.subject).toMatchObject({ type: 'work_order', id: TEST_WORK_ORDER_ID })
      expect(observation.causality.propagationId).toBe(causedByPropagationId)
      expect(observation.signals[0]).toMatchObject({
        axis: 'work_order.execution',
        kind: 'condition_retracted',
        value: 'blocked',
        reason: 'resumed',
      })
    })

    await Effect.runPromise(program)
  })
})
