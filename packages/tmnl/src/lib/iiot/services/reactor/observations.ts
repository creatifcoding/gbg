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
import { AlarmEvents, ContextEvents, EquipmentStateEvents, StructuralEvents, WorkOrderEvents } from '../../schemas/events/groups'
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
  readonly causedByPropagationId?: PropagationId
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
      causedByPropagationId: input.causedByPropagationId,
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
        causedByPropagationId: payload.causedByPropagationId,
        payload,
      })
    }),
}

const alarmSafetyObservation = (input: {
  readonly entry: EventJournal.Entry
  readonly deviceId: string
  readonly kind: 'condition_asserted' | 'condition_retracted'
  readonly value: 'hold' | 'informational'
  readonly reason: string
  readonly propagationId?: PropagationId
  readonly payload: unknown
}): ReactorObservation =>
  new ReactorObservation({
    event: eventEnvelopeFromEntry(input.entry),
    subject: new RelationshipEndpoint({ type: 'device', id: input.deviceId }),
    signals: [
      new ObservationSignal({
        axis: 'alarm.safety',
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

export const AlarmTriggeredObservationSpec: EventObservationSpec = {
  id: 'alarm-triggered-safety-observation',
  eventTag: 'AlarmTriggered',
  observe: (entry) =>
    Effect.gen(function* () {
      const event = AlarmEvents.events.AlarmTriggered
      const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entry.payload)
      const safetyValue = payload.severity === 'critical' || payload.severity === 'emergency'
        ? 'hold'
        : 'informational'

      return alarmSafetyObservation({
        entry,
        deviceId: payload.deviceId,
        kind: 'condition_asserted',
        value: safetyValue,
        reason: `${payload.severity}:${payload.alarmType}`,
        propagationId: payload.alarmId as unknown as PropagationId,
        payload,
      })
    }),
}

export const AlarmEscalatedObservationSpec: EventObservationSpec = {
  id: 'alarm-escalated-safety-observation',
  eventTag: 'AlarmEscalated',
  observe: (entry) =>
    Effect.gen(function* () {
      const event = AlarmEvents.events.AlarmEscalated
      const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entry.payload)

      return alarmSafetyObservation({
        entry,
        deviceId: payload.deviceId,
        kind: 'condition_asserted',
        value: 'hold',
        reason: `escalated:${payload.escalationLevel}`,
        propagationId: payload.alarmId as unknown as PropagationId,
        payload,
      })
    }),
}

export const AlarmClearedObservationSpec: EventObservationSpec = {
  id: 'alarm-cleared-safety-observation',
  eventTag: 'AlarmCleared',
  observe: (entry) =>
    Effect.gen(function* () {
      const event = AlarmEvents.events.AlarmCleared
      const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entry.payload)
      const note = Option.isSome(payload.notes) ? payload.notes.value : 'cleared'

      return alarmSafetyObservation({
        entry,
        deviceId: payload.deviceId,
        kind: 'condition_retracted',
        value: 'hold',
        reason: note,
        propagationId: payload.alarmId as unknown as PropagationId,
        payload,
      })
    }),
}

const structuralDecommissionObservation = (input: {
  readonly entry: EventJournal.Entry
  readonly entityType: RelationshipEndpoint['type']
  readonly entityId: string
  readonly reason: string
  readonly payload: unknown
}): ReactorObservation =>
  new ReactorObservation({
    event: eventEnvelopeFromEntry(input.entry),
    subject: new RelationshipEndpoint({ type: input.entityType, id: input.entityId }),
    signals: [
      new ObservationSignal({
        axis: 'structural.lifecycle',
        kind: 'condition_asserted',
        value: 'decommissioned',
        reason: input.reason,
      }),
    ],
    causality: new ReactorCausality({
      propagationId: input.entry.idString as PropagationId,
    }),
    payload: input.payload,
  })

type StructuralDecommissionPayload = Record<string, unknown> & {
  readonly reason?: unknown
}

const structuralDecommissionObservationSpec = (input: {
  readonly id: string
  readonly eventTag: keyof typeof StructuralEvents.events
  readonly entityType: RelationshipEndpoint['type']
  readonly idField: string
}): EventObservationSpec => ({
  id: input.id,
  eventTag: input.eventTag,
  observe: (entry) =>
    Effect.gen(function* () {
      const event = StructuralEvents.events[input.eventTag] as { payloadMsgPack: Schema.Schema<unknown, Uint8Array> }
      const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entry.payload)
      const record = payload as StructuralDecommissionPayload

      return structuralDecommissionObservation({
        entry,
        entityType: input.entityType,
        entityId: String(record[input.idField]),
        reason: typeof record.reason === 'string' ? record.reason : 'decommissioned',
        payload,
      })
    }),
})

export const EnterpriseDecommissionedObservationSpec = structuralDecommissionObservationSpec({
  id: 'enterprise-decommissioned-structural-observation',
  eventTag: 'EnterpriseDecommissioned',
  entityType: 'enterprise',
  idField: 'enterpriseId',
})

export const SiteDecommissionedObservationSpec = structuralDecommissionObservationSpec({
  id: 'site-decommissioned-structural-observation',
  eventTag: 'SiteDecommissioned',
  entityType: 'site',
  idField: 'siteId',
})

export const AreaDecommissionedObservationSpec = structuralDecommissionObservationSpec({
  id: 'area-decommissioned-structural-observation',
  eventTag: 'AreaDecommissioned',
  entityType: 'area',
  idField: 'areaId',
})

export const PlantDecommissionedObservationSpec = structuralDecommissionObservationSpec({
  id: 'plant-decommissioned-structural-observation',
  eventTag: 'PlantDecommissioned',
  entityType: 'plant',
  idField: 'plantId',
})

export const LineDecommissionedObservationSpec = structuralDecommissionObservationSpec({
  id: 'line-decommissioned-structural-observation',
  eventTag: 'LineDecommissioned',
  entityType: 'line',
  idField: 'lineId',
})

export const WorkCellDecommissionedObservationSpec = structuralDecommissionObservationSpec({
  id: 'workcell-decommissioned-structural-observation',
  eventTag: 'WorkCellDecommissioned',
  entityType: 'workcell',
  idField: 'workCellId',
})

export const MachineDecommissionedObservationSpec = structuralDecommissionObservationSpec({
  id: 'machine-decommissioned-structural-observation',
  eventTag: 'MachineDecommissioned',
  entityType: 'machine',
  idField: 'machineId',
})

export const SensorDecommissionedObservationSpec = structuralDecommissionObservationSpec({
  id: 'sensor-decommissioned-structural-observation',
  eventTag: 'SensorDecommissioned',
  entityType: 'sensor',
  idField: 'sensorId',
})

export const DeviceDecommissionedObservationSpec: EventObservationSpec = {
  id: 'device-decommissioned-structural-observation',
  eventTag: 'DeviceDecommissioned',
  observe: (entry) =>
    Effect.gen(function* () {
      const event = StructuralEvents.events.DeviceDecommissioned
      const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entry.payload)

      return new ReactorObservation({
        event: eventEnvelopeFromEntry(entry),
        subject: new RelationshipEndpoint({ type: 'device', id: payload.deviceId }),
        signals: [
          new ObservationSignal({
            axis: 'structural.lifecycle',
            kind: 'condition_asserted',
            value: 'decommissioned',
            reason: payload.reason,
          }),
          new ObservationSignal({
            axis: 'device.availability',
            kind: 'condition_asserted',
            value: 'unavailable',
            reason: payload.reason,
          }),
        ],
        causality: new ReactorCausality({
          propagationId: payload.deviceId as PropagationId,
        }),
        payload,
      })
    }),
}

const externalAvailabilityObservation = (input: {
  readonly entry: EventJournal.Entry
  readonly externalRefId: string
  readonly value: 'available' | 'unavailable'
  readonly reason: string
  readonly payload: unknown
}): ReactorObservation =>
  new ReactorObservation({
    event: eventEnvelopeFromEntry(input.entry),
    subject: new RelationshipEndpoint({ type: 'external', id: input.externalRefId }),
    signals: [
      new ObservationSignal({
        axis: 'external.availability',
        kind: 'condition_asserted',
        value: input.value,
        reason: input.reason,
      }),
    ],
    causality: new ReactorCausality(input.value === 'available'
      ? {
        propagationId: input.entry.idString as PropagationId,
        causedByPropagationId: input.externalRefId as PropagationId,
      }
      : {
        propagationId: input.externalRefId as PropagationId,
      }),
    payload: input.payload,
  })

export const ExternalRefLinkedAvailabilityObservationSpec: EventObservationSpec = {
  id: 'external-ref-linked-availability-observation',
  eventTag: 'ExternalRefLinked',
  observe: (entry) =>
    Effect.gen(function* () {
      const event = ContextEvents.events.ExternalRefLinked
      const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entry.payload)

      return externalAvailabilityObservation({
        entry,
        externalRefId: payload.externalRefId,
        value: 'available',
        reason: `external_ref_linked:${payload.externalSystem}:${payload.externalType}`,
        payload,
      })
    }),
}

export const ExternalRefUnlinkedAvailabilityObservationSpec: EventObservationSpec = {
  id: 'external-ref-unlinked-availability-observation',
  eventTag: 'ExternalRefUnlinked',
  observe: (entry) =>
    Effect.gen(function* () {
      const event = ContextEvents.events.ExternalRefUnlinked
      const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(entry.payload)

      return externalAvailabilityObservation({
        entry,
        externalRefId: payload.externalRefId,
        value: 'unavailable',
        reason: `external_ref_unlinked:${payload.reason}`,
        payload,
      })
    }),
}

export const ReactiveEquipmentStateObservationSpecs = [
  EquipmentStateChangedObservationSpec,
  MaintenanceModeEnteredObservationSpec,
  FaultDetectedObservationSpec,
] as const

export const AlarmSafetyObservationSpecs = [
  AlarmTriggeredObservationSpec,
  AlarmEscalatedObservationSpec,
  AlarmClearedObservationSpec,
] as const

export const StructuralDecommissionObservationSpecs = [
  EnterpriseDecommissionedObservationSpec,
  SiteDecommissionedObservationSpec,
  AreaDecommissionedObservationSpec,
  PlantDecommissionedObservationSpec,
  LineDecommissionedObservationSpec,
  WorkCellDecommissionedObservationSpec,
  MachineDecommissionedObservationSpec,
  SensorDecommissionedObservationSpec,
  DeviceDecommissionedObservationSpec,
] as const

export const ExternalAvailabilityObservationSpecs = [
  ExternalRefLinkedAvailabilityObservationSpec,
  ExternalRefUnlinkedAvailabilityObservationSpec,
] as const

export const DeviceAvailabilityObservationSpecs = [
  DeviceDecommissionedObservationSpec,
] as const

export const WorkOrderDependencyObservationSpecs = [
  WorkOrderSuspendedObservationSpec,
  WorkOrderFailedObservationSpec,
  WorkOrderCancelledObservationSpec,
  WorkOrderCompletedObservationSpec,
  WorkOrderResumedObservationSpec,
] as const
