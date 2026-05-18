/**
 * DomainEventEmitter — durable + realtime IIoT domain event emission.
 *
 * Phase 0 wiring for the Reactor consistency model:
 * - writes schema-backed events through @effect/experimental EventLog
 * - mirrors selected live DTOs into EventDistribution when available
 * - preserves current machine behavior: emission failures are logged, not raised
 *
 * The service is optional at entity wiring boundaries. Machines can run without it
 * while feature flags remain disabled or during legacy tests.
 *
 * @module
 */

import { Cause, Context, DateTime, Effect, Layer, Option } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import { IIoTEventLogSchema } from '../../infrastructure/eventlog-layer'
import { AlarmEvents, StructuralEvents } from '../../schemas/events/groups'
import type { WorkOrder } from '../../schemas/work-orders'
import type { WorkOrderEventTag } from '../../schemas/events/operational/work-order-events'
import type { EquipmentState as EventEquipmentState } from '../../schemas/events/operational/equipment-state-events'
import type {
  AssetId,
  EventId,
  MachineId,
  PropagationId,
} from '../../schemas/identifiers'
import { EventDistribution, EquipmentStateChange, WorkOrderLifecycleEvent } from '../../realtime/event-distribution'

// =============================================================================
// Input Shapes
// =============================================================================

export interface WorkOrderLifecycleEmission {
  readonly tag: WorkOrderEventTag
  readonly workOrder: WorkOrder
  readonly actor?: string
  readonly reason?: string
  readonly notes?: string
  readonly propagationId?: PropagationId
  readonly causedByPropagationId?: PropagationId
}

export interface EquipmentStateChangedEmission {
  readonly machineId: MachineId
  readonly previousState: string
  readonly newState: string
  readonly reason?: string
  readonly triggeredBy?: string
  readonly propagationId?: PropagationId
}

export interface StructuralEventEmission {
  readonly tag: keyof typeof StructuralEvents.events
  readonly payload: unknown
}

export interface AlarmEventEmission {
  readonly tag: keyof typeof AlarmEvents.events
  readonly payload: unknown
}

export interface DomainEventEmitterShape {
  /** Compatibility path: durable + realtime emission; failures are logged and swallowed. */
  readonly emitWorkOrderLifecycle: (event: WorkOrderLifecycleEmission) => Effect.Effect<void>
  /** Compatibility path: durable + realtime emission; failures are logged and swallowed. */
  readonly emitEquipmentStateChanged: (event: EquipmentStateChangedEmission) => Effect.Effect<void>
  /** Transactional path: durable write failure is returned to the caller; realtime remains best-effort. */
  readonly emitWorkOrderLifecycleStrict: (event: WorkOrderLifecycleEmission) => Effect.Effect<void>
  /** Transactional path: durable write failure is returned to the caller; realtime remains best-effort. */
  readonly emitEquipmentStateChangedStrict: (event: EquipmentStateChangedEmission) => Effect.Effect<void>
  /** Transactional path for selected structural EventGroup facts. */
  readonly emitStructuralEventStrict: (event: StructuralEventEmission) => Effect.Effect<void>
  /** Transactional path for selected alarm EventGroup facts. */
  readonly emitAlarmEventStrict: (event: AlarmEventEmission) => Effect.Effect<void>
}

// =============================================================================
// Service Tag
// =============================================================================

export class DomainEventEmitter extends Context.Tag('iiot/DomainEventEmitter')<
  DomainEventEmitter,
  DomainEventEmitterShape
>() {}

// =============================================================================
// Helpers
// =============================================================================

const makeEventId = (): EventId =>
  `EVT-${Date.now()}-${Math.random().toString(36).slice(2)}` as EventId

const noneString = (): Option.Option<string> => Option.none()

const optionalString = (value: string | undefined): Option.Option<string> =>
  value && value.length > 0 ? Option.some(value) : Option.none()

const optionalRecord = (value: Record<string, unknown>): Option.Option<Record<string, unknown>> =>
  Object.keys(value).length > 0 ? Option.some(value) : Option.none()

const optionValue = <A>(option: Option.Option<A>): A | undefined =>
  Option.isSome(option) ? option.value : undefined

const workOrderActor = (event: WorkOrderLifecycleEmission): string =>
  event.actor ?? event.workOrder.createdBy ?? 'system'

const workOrderAssetId = (workOrder: WorkOrder): AssetId =>
  Option.isSome(workOrder.primaryAssetId)
    ? workOrder.primaryAssetId.value
    : (workOrder.id as unknown as AssetId)

const workOrderBasePayload = (event: WorkOrderLifecycleEmission) => ({
  eventId: makeEventId(),
  occurredAt: DateTime.unsafeNow(),
  causedBy: workOrderActor(event),
  entityId: workOrderAssetId(event.workOrder),
  // Work orders target ISA-95 assets. Until relationship metadata stores the
  // precise target level, use machine as the conservative default used by tests.
  entityType: 'machine' as const,
  correlationId: noneString(),
  schemaVersion: 1,
})

const makeWorkOrderEventPayload = (event: WorkOrderLifecycleEmission): unknown => {
  const workOrder = event.workOrder
  const actor = workOrderActor(event)
  const base = workOrderBasePayload(event)

  switch (event.tag) {
    case 'WorkOrderCreated':
      return {
        ...base,
        workOrderId: workOrder.id,
        templateId: Option.some(workOrder.workflowDefinitionId),
        priority: workOrder.priority,
        scheduledStart: workOrder.scheduledStart,
        assignedTo: workOrder.assignedTo,
        title: workOrder.title,
        description: optionalString(workOrder.description),
        metadata: optionalRecord(workOrder.metadata),
      }

    case 'WorkOrderSubmitted':
      return {
        ...base,
        workOrderId: workOrder.id,
        comments: optionalString(event.notes),
      }

    case 'WorkOrderApproved':
      return {
        ...base,
        workOrderId: workOrder.id,
        approvedBy: actor,
        approvalLevel: 1,
        comments: optionalString(event.notes),
      }

    case 'WorkOrderRejected':
      return {
        ...base,
        workOrderId: workOrder.id,
        rejectedBy: actor,
        reason: event.reason ?? 'unspecified',
      }

    case 'WorkOrderStarted':
      return {
        ...base,
        workOrderId: workOrder.id,
        startedBy: actor,
        assignedTo: workOrder.assignedTo,
      }

    case 'WorkOrderSuspended':
      return {
        ...base,
        workOrderId: workOrder.id,
        suspendedBy: actor,
        reason: optionValue(workOrder.suspensionReason) ?? event.reason ?? 'other',
        expectedResume: workOrder.expectedResume,
        notes: optionalString(event.notes),
        ...(event.propagationId ? { propagationId: event.propagationId } : {}),
        ...(event.causedByPropagationId ? { causedByPropagationId: event.causedByPropagationId } : {}),
      }

    case 'WorkOrderResumed':
      return {
        ...base,
        workOrderId: workOrder.id,
        resumedBy: actor,
        notes: optionalString(event.notes),
      }

    case 'WorkOrderCompleted':
      return {
        ...base,
        workOrderId: workOrder.id,
        completedBy: actor,
        outcome: optionValue(workOrder.outcome) ?? 'success',
        summary: optionValue(workOrder.summary) ?? event.notes ?? 'Completed',
        actualDurationMinutes: Option.none() as Option.Option<number>,
      }

    case 'WorkOrderFailed':
      return {
        ...base,
        workOrderId: workOrder.id,
        failedTaskId: workOrder.failedTaskId,
        failureReason: optionValue(workOrder.failureReason) ?? event.reason ?? 'unspecified',
        reportedBy: actor,
      }

    case 'WorkOrderCancelled':
      return {
        ...base,
        workOrderId: workOrder.id,
        cancelledBy: actor,
        reason: optionValue(workOrder.cancellationReason) ?? event.reason ?? 'unspecified',
        compensationRequired: workOrder.compensationRequired,
      }

    case 'WorkOrderClosed':
      return {
        ...base,
        workOrderId: workOrder.id,
        closedBy: actor,
        finalStatus: optionValue(workOrder.finalStatus) ?? 'completed_success',
        archiveReference: Option.none() as Option.Option<string>,
        notes: optionalString(event.notes),
      }
  }
}

const toEventEquipmentState = (state: string): EventEquipmentState => {
  switch (state) {
    case 'running':
    case 'operational':
      return 'operational'
    case 'setup':
    case 'blocked':
    case 'degraded':
      return 'degraded'
    case 'unplanned_downtime':
    case 'faulted':
      return 'faulted'
    case 'planned_downtime':
    case 'maintenance':
      return 'maintenance'
    case 'idle':
    case 'offline':
    default:
      return 'offline'
  }
}

const makeEquipmentStateChangedPayload = (event: EquipmentStateChangedEmission) => ({
  eventId: makeEventId(),
  occurredAt: DateTime.unsafeNow(),
  causedBy: event.triggeredBy ?? 'system',
  entityId: event.machineId as unknown as AssetId,
  entityType: 'machine' as const,
  correlationId: noneString(),
  schemaVersion: 1,
  machineId: event.machineId,
  previousState: toEventEquipmentState(event.previousState),
  newState: toEventEquipmentState(event.newState),
  ...(event.propagationId ? { propagationId: event.propagationId } : {}),
  reason: optionalString(event.reason),
  triggeredBy: optionalString(event.triggeredBy),
})

const ignoreEmissionFailure = (label: string) => <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.catchAllCause((cause) =>
      Effect.logWarning(`[DomainEventEmitter] ${label} failed: ${Cause.pretty(cause)}`)
    ),
    Effect.asVoid,
  )

// =============================================================================
// Layer
// =============================================================================

const makeDomainEventEmitter = Effect.gen(function* () {
  const client = yield* EventLog.makeClient(IIoTEventLogSchema)
  const distribution = yield* Effect.serviceOption(EventDistribution)

  const writeEvent = (tag: string, payload: unknown) =>
    (client as unknown as (event: string, payload: unknown) => Effect.Effect<unknown>)(tag, payload).pipe(
      Effect.asVoid,
    )

  const publishWorkOrderRealtime = (event: WorkOrderLifecycleEmission) =>
    Option.match(distribution, {
      onNone: () => Effect.void,
      onSome: (hub) => hub.publishWorkOrderLifecycle(new WorkOrderLifecycleEvent({
        workOrderId: event.workOrder.id,
        eventTag: event.tag,
        status: event.workOrder.status,
        timestamp: new Date().toISOString(),
        ...(event.propagationId ? { propagationId: event.propagationId } : {}),
        ...(event.causedByPropagationId ? { causedByPropagationId: event.causedByPropagationId } : {}),
      })),
    })

  const publishEquipmentRealtime = (event: EquipmentStateChangedEmission) =>
    Option.match(distribution, {
      onNone: () => Effect.void,
      onSome: (hub) => hub.publishEquipmentStateChange(new EquipmentStateChange({
        equipmentId: event.machineId,
        previousState: event.previousState,
        newState: event.newState,
        timestamp: new Date().toISOString(),
        ...(event.propagationId ? { propagationId: event.propagationId } : {}),
      })),
    })

  const emitWorkOrderLifecycleStrict = (event: WorkOrderLifecycleEmission): Effect.Effect<void> =>
    Effect.zipRight(
      writeEvent(event.tag, makeWorkOrderEventPayload(event)),
      publishWorkOrderRealtime(event).pipe(ignoreEmissionFailure(`publish ${event.tag} realtime`)),
    )

  const emitEquipmentStateChangedStrict = (event: EquipmentStateChangedEmission): Effect.Effect<void> =>
    Effect.zipRight(
      writeEvent('EquipmentStateChanged', makeEquipmentStateChangedPayload(event)),
      publishEquipmentRealtime(event).pipe(ignoreEmissionFailure('publish EquipmentStateChanged realtime')),
    )

  const emitWorkOrderLifecycle = (event: WorkOrderLifecycleEmission): Effect.Effect<void> =>
    emitWorkOrderLifecycleStrict(event).pipe(ignoreEmissionFailure(`emit ${event.tag}`))

  const emitEquipmentStateChanged = (event: EquipmentStateChangedEmission): Effect.Effect<void> =>
    emitEquipmentStateChangedStrict(event).pipe(ignoreEmissionFailure('emit EquipmentStateChanged'))

  const emitStructuralEventStrict = (event: StructuralEventEmission): Effect.Effect<void> =>
    writeEvent(event.tag, event.payload)

  const emitAlarmEventStrict = (event: AlarmEventEmission): Effect.Effect<void> =>
    writeEvent(event.tag, event.payload)

  return DomainEventEmitter.of({
    emitWorkOrderLifecycle,
    emitEquipmentStateChanged,
    emitWorkOrderLifecycleStrict,
    emitEquipmentStateChangedStrict,
    emitStructuralEventStrict,
    emitAlarmEventStrict,
  })
})

export const DomainEventEmitterLive: Layer.Layer<
  DomainEventEmitter,
  never,
  EventLog.EventLog
> = Layer.effect(DomainEventEmitter, makeDomainEventEmitter)
