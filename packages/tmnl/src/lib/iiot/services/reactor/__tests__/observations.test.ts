import { describe, expect, it } from 'vitest'
import { DateTime, Effect, Option, Schema } from 'effect'
import * as EventJournal from '@effect/experimental/EventJournal'
import {
  EquipmentStateChangedObservationSpec,
  FaultDetectedObservationSpec,
  MaintenanceModeEnteredObservationSpec,
  ReactiveEquipmentStateObservationSpecs,
} from '../observations'
import { EquipmentStateEvents } from '../../../schemas/events/groups'
import type {
  AssetId,
  EquipmentLevel,
  EventId,
  MachineId,
  PropagationId,
} from '../../../schemas/identifiers'

const TEST_MACHINE_ID = 'MCH-OBSERVATION-001' as MachineId

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
})
