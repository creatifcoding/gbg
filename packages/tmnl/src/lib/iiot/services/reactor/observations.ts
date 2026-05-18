/** Reactor observation adapters for durable domain events. */

import { Effect, Option, Schema } from 'effect'
import * as EventJournal from '@effect/experimental/EventJournal'
import {
  ObservationSignal,
  ReactorCausality,
  ReactorEventEnvelope,
  ReactorObservation,
} from '../../schemas/reactor'
import type { PropagationId } from '../../schemas/identifiers'
import { RelationshipEndpoint } from '../../schemas/relationships'
import { EquipmentStateEvents } from '../../schemas/events/groups'
import type { EventObservationSpec } from './ReactorRegistry'

const unavailableEquipmentStates = new Set([
  'maintenance',
  'planned_downtime',
  'unplanned_downtime',
  'faulted',
  'offline',
])

const eventEnvelopeFromEntry = (entry: EventJournal.Entry) =>
  new ReactorEventEnvelope({
    entryId: entry.idString as never,
    tag: entry.event,
    primaryKey: entry.primaryKey,
    occurredAt: entry.createdAt,
  })

export const EquipmentStateChangedObservationSpec: EventObservationSpec = {
  id: 'equipment-state-changed-observation',
  eventTag: 'EquipmentStateChanged',
  observe: (entry) =>
    Effect.gen(function* () {
      const event = EquipmentStateEvents.events.EquipmentStateChanged
      const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entry.payload)
      const unavailable = unavailableEquipmentStates.has(payload.newState)
      const reason = Option.isSome(payload.reason) ? payload.reason.value : payload.newState

      return new ReactorObservation({
        event: eventEnvelopeFromEntry(entry),
        subject: new RelationshipEndpoint({ type: 'machine', id: payload.machineId }),
        signals: [
          new ObservationSignal({
            axis: 'equipment.availability',
            kind: 'condition_asserted',
            value: unavailable ? 'unavailable' : 'available',
            previousValue: payload.previousState,
            reason,
          }),
        ],
        causality: new ReactorCausality({
          propagationId: payload.propagationId ?? (entry.idString as PropagationId),
        }),
        payload,
      })
    }),
}
