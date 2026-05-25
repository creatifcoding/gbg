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
import { EquipmentStateEvents, WorkOrderEvents } from '../../schemas/events/groups'
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

const equipmentAvailabilityObservation = (input: {
  readonly entry: EventJournal.Entry
  readonly machineId: string
  readonly value: 'available' | 'unavailable'
  readonly reason: string
  readonly previousValue?: string
  readonly propagationId?: PropagationId
  readonly payload: unknown
}): ReactorObservation =>
  new ReactorObservation({
    event: eventEnvelopeFromEntry(input.entry),
    subject: new RelationshipEndpoint({ type: 'machine', id: input.machineId }),
    signals: [
      new ObservationSignal({
        axis: 'equipment.availability',
        kind: 'condition_asserted',
        value: input.value,
        previousValue: input.previousValue,
        reason: input.reason,
      }),
    ],
    causality: new ReactorCausality({
      propagationId: input.propagationId ?? (input.entry.idString as PropagationId),
    }),
    payload: input.payload,
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

      return equipmentAvailabilityObservation({
        entry,
        machineId: payload.machineId,
        value: unavailable ? 'unavailable' : 'available',
        previousValue: payload.previousState,
        reason,
        propagationId: payload.propagationId,
        payload,
      })
    }),
}

export const MaintenanceModeEnteredObservationSpec: EventObservationSpec = {
  id: 'maintenance-mode-entered-observation',
  eventTag: 'MaintenanceModeEntered',
  observe: (entry) =>
    Effect.gen(function* () {
      const event = EquipmentStateEvents.events.MaintenanceModeEntered
      const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entry.payload)
      const note = Option.isSome(payload.notes) ? payload.notes.value : payload.maintenanceType

      return equipmentAvailabilityObservation({
        entry,
        machineId: payload.machineId,
        value: 'unavailable',
        previousValue: 'operational',
        reason: `maintenance:${note}`,
        payload,
      })
    }),
}

export const FaultDetectedObservationSpec: EventObservationSpec = {
  id: 'fault-detected-observation',
  eventTag: 'FaultDetected',
  observe: (entry) =>
    Effect.gen(function* () {
      const event = EquipmentStateEvents.events.FaultDetected
      const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entry.payload)

      return equipmentAvailabilityObservation({
        entry,
        machineId: payload.machineId,
        value: 'unavailable',
        previousValue: 'operational',
        reason: `${payload.faultSeverity}:${payload.faultCode}`,
        payload,
      })
    }),
}

const workOrderDependencyObservation = (input: {
  readonly entry: EventJournal.Entry
  readonly workOrderId: string
  readonly kind: 'condition_asserted' | 'condition_retracted'
  readonly value: 'blocked' | 'satisfied'
  readonly reason: string
  readonly propagationId?: PropagationId
  readonly payload: unknown
}): ReactorObservation =>
  new ReactorObservation({
    event: eventEnvelopeFromEntry(input.entry),
    subject: new RelationshipEndpoint({ type: 'work_order', id: input.workOrderId }),
    signals: [
      new ObservationSignal({
        axis: 'work_order.execution',
        kind: input.kind,
        value: input.value,
        reason: input.reason,
      }),
    ],
    causality: new ReactorCausality({
      propagationId: input.propagationId ?? (input.entry.idString as PropagationId),
    }),
    payload: input.payload,
  })

export const WorkOrderSuspendedObservationSpec: EventObservationSpec = {
  id: 'work-order-suspended-dependency-observation',
  eventTag: 'WorkOrderSuspended',
  observe: (entry) =>
    Effect.gen(function* () {
      const event = WorkOrderEvents.events.WorkOrderSuspended
      const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entry.payload)

      return workOrderDependencyObservation({
        entry,
        workOrderId: payload.workOrderId,
        kind: 'condition_asserted',
        value: 'blocked',
        reason: payload.reason,
        propagationId: payload.propagationId ?? payload.causedByPropagationId,
        payload,
      })
    }),
}

export const WorkOrderFailedObservationSpec: EventObservationSpec = {
  id: 'work-order-failed-dependency-observation',
  eventTag: 'WorkOrderFailed',
  observe: (entry) =>
    Effect.gen(function* () {
      const event = WorkOrderEvents.events.WorkOrderFailed
      const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entry.payload)

      return workOrderDependencyObservation({
        entry,
        workOrderId: payload.workOrderId,
        kind: 'condition_asserted',
        value: 'blocked',
        reason: payload.failureReason,
        payload,
      })
    }),
}

export const WorkOrderCancelledObservationSpec: EventObservationSpec = {
  id: 'work-order-cancelled-dependency-observation',
  eventTag: 'WorkOrderCancelled',
  observe: (entry) =>
    Effect.gen(function* () {
      const event = WorkOrderEvents.events.WorkOrderCancelled
      const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entry.payload)

      return workOrderDependencyObservation({
        entry,
        workOrderId: payload.workOrderId,
        kind: 'condition_asserted',
        value: 'blocked',
        reason: payload.reason,
        payload,
      })
    }),
}

export const WorkOrderCompletedObservationSpec: EventObservationSpec = {
  id: 'work-order-completed-dependency-observation',
  eventTag: 'WorkOrderCompleted',
  observe: (entry) =>
    Effect.gen(function* () {
      const event = WorkOrderEvents.events.WorkOrderCompleted
      const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entry.payload)

      return workOrderDependencyObservation({
        entry,
        workOrderId: payload.workOrderId,
        kind: 'condition_asserted',
        value: 'satisfied',
        reason: payload.outcome,
        payload,
      })
    }),
}

export const WorkOrderResumedObservationSpec: EventObservationSpec = {
  id: 'work-order-resumed-dependency-observation',
  eventTag: 'WorkOrderResumed',
  observe: (entry) =>
    Effect.gen(function* () {
      const event = WorkOrderEvents.events.WorkOrderResumed
      const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entry.payload)

      return workOrderDependencyObservation({
        entry,
        workOrderId: payload.workOrderId,
        kind: 'condition_retracted',
        value: 'blocked',
        reason: 'resumed',
        propagationId: payload.causedByPropagationId,
        payload,
      })
    }),
}

export const ReactiveEquipmentStateObservationSpecs = [
  EquipmentStateChangedObservationSpec,
  MaintenanceModeEnteredObservationSpec,
  FaultDetectedObservationSpec,
] as const

export const WorkOrderDependencyObservationSpecs = [
  WorkOrderSuspendedObservationSpec,
  WorkOrderFailedObservationSpec,
  WorkOrderCancelledObservationSpec,
  WorkOrderCompletedObservationSpec,
  WorkOrderResumedObservationSpec,
] as const
