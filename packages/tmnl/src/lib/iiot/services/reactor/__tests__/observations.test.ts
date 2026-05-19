import { describe, expect, it } from 'vitest'
import { DateTime, Effect, Option, Schema } from 'effect'
import * as EventJournal from '@effect/experimental/EventJournal'
import { EquipmentStateChangedObservationSpec } from '../observations'
import { EquipmentStateEvents } from '../../../schemas/events/groups'
import type {
  AssetId,
  EquipmentLevel,
  EventId,
  MachineId,
  PropagationId,
} from '../../../schemas/identifiers'

const makeEquipmentStateChangedEntry = (overrides?: {
  readonly newState?: 'operational' | 'degraded' | 'faulted' | 'maintenance' | 'offline'
  readonly propagationId?: PropagationId
}) => Effect.gen(function* () {
  const event = EquipmentStateEvents.events.EquipmentStateChanged
  const machineId = 'MCH-OBSERVATION-001' as MachineId
  const payload = {
    eventId: 'EVT-OBSERVATION-001' as EventId,
    occurredAt: DateTime.unsafeNow(),
    causedBy: 'reactor-observation-test',
    entityId: machineId as unknown as AssetId,
    entityType: 'machine' as EquipmentLevel,
    correlationId: Option.none(),
    schemaVersion: 1,
    machineId,
    previousState: 'operational' as const,
    newState: overrides?.newState ?? 'faulted',
    propagationId: overrides?.propagationId,
    reason: Option.some('observation test'),
    triggeredBy: Option.some('vitest'),
  }

  const encodedPayload = yield* Schema.encode(event.payloadMsgPack)(payload)

  return new EventJournal.Entry({
    id: EventJournal.makeEntryId(),
    event: 'EquipmentStateChanged',
    primaryKey: machineId,
    payload: encodedPayload,
  })
})

describe('Reactor observation adapters', () => {
  it('decodes EquipmentStateChanged into machine availability unavailable signal', async () => {
    const program = Effect.gen(function* () {
      const propagationId = 'PRP-OBSERVATION-001' as PropagationId
      const entry = yield* makeEquipmentStateChangedEntry({ propagationId })
      const observation = yield* EquipmentStateChangedObservationSpec.observe(entry)

      expect(observation.event.entryId).toBe(entry.idString)
      expect(observation.event.tag).toBe('EquipmentStateChanged')
      expect(observation.subject).toMatchObject({ type: 'machine', id: 'MCH-OBSERVATION-001' })
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
})
