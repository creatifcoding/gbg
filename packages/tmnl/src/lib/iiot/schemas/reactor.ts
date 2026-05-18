/**
 * Reactor domain schemas.
 *
 * Schema-backed contracts for relationship consistency sidecars: checkpoints,
 * delivery dedupe, and replay cursors.
 *
 * @module
 */

import { Schema } from 'effect'
import { MachineId, PropagationId, WorkOrderId } from './identifiers'
import { StateType } from './equipment-state/schema'
import { WorkOrderStatus } from './work-orders'
import {
  EntityCapabilityId,
  ObservationSignalKind,
  PropagationPolicyId,
  RelationshipEndpoint,
} from './relationships/edge-types'

export const ReactorConsumerId = Schema.String.pipe(Schema.brand('ReactorConsumerId'))
export type ReactorConsumerId = typeof ReactorConsumerId.Type

export const ReactorSourceEntryId = Schema.String.pipe(Schema.brand('ReactorSourceEntryId'))
export type ReactorSourceEntryId = typeof ReactorSourceEntryId.Type

export const ReactorCheckpointOutcome = Schema.Literal('processed', 'skipped', 'failed')
export type ReactorCheckpointOutcome = typeof ReactorCheckpointOutcome.Type

export class ReactorCheckpointRecord extends Schema.TaggedClass<ReactorCheckpointRecord>()('ReactorCheckpointRecord', {
  consumerId: ReactorConsumerId,
  sourceEntryId: ReactorSourceEntryId,
  sourceEvent: Schema.String,
  primaryKey: Schema.String,
  outcome: ReactorCheckpointOutcome,
  processedAt: Schema.DateTimeUtc,
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
}) {}

export class ReactorCheckpointInsert extends Schema.TaggedClass<ReactorCheckpointInsert>()('ReactorCheckpointInsert', {
  consumerId: ReactorConsumerId,
  sourceEntryId: ReactorSourceEntryId,
  sourceEvent: Schema.String,
  primaryKey: Schema.String,
  outcome: ReactorCheckpointOutcome,
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}

// =============================================================================
// Generic Reactor propagation contracts
// =============================================================================

export const ReactorRequestId = Schema.String.pipe(Schema.brand('ReactorRequestId'))
export type ReactorRequestId = typeof ReactorRequestId.Type

export class ReactorEventEnvelope extends Schema.TaggedClass<ReactorEventEnvelope>()('ReactorEventEnvelope', {
  entryId: ReactorSourceEntryId,
  tag: Schema.String,
  primaryKey: Schema.String,
  occurredAt: Schema.DateTimeUtc,
}) {}
export type ReactorEventEnvelope = typeof ReactorEventEnvelope.Type

export class ReactorCausality extends Schema.TaggedClass<ReactorCausality>()('ReactorCausality', {
  propagationId: PropagationId,
  causedByPropagationId: Schema.optional(PropagationId),
}) {}
export type ReactorCausality = typeof ReactorCausality.Type

export class ObservationSignal extends Schema.TaggedClass<ObservationSignal>()('ObservationSignal', {
  axis: Schema.String,
  kind: ObservationSignalKind,
  value: Schema.String,
  previousValue: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String),
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}
export type ObservationSignal = typeof ObservationSignal.Type

export class ReactorObservation extends Schema.TaggedClass<ReactorObservation>()('ReactorObservation', {
  event: ReactorEventEnvelope,
  subject: RelationshipEndpoint,
  signals: Schema.NonEmptyArray(ObservationSignal),
  causality: ReactorCausality,
  payload: Schema.Unknown,
}) {}
export type ReactorObservation = typeof ReactorObservation.Type

export class EntityReactionRequest extends Schema.TaggedClass<EntityReactionRequest>()('EntityReactionRequest', {
  requestId: ReactorRequestId,
  capability: EntityCapabilityId,
  source: RelationshipEndpoint,
  target: RelationshipEndpoint,
  signal: ObservationSignal,
  policyId: PropagationPolicyId,
  policyVersion: Schema.String,
  causality: ReactorCausality,
  payload: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}
export type EntityReactionRequest = typeof EntityReactionRequest.Type

export const ReactorDecisionOutcome = Schema.Literal('eligible', 'dispatched', 'skipped', 'deferred', 'failed')
export type ReactorDecisionOutcome = typeof ReactorDecisionOutcome.Type

export class ReactorDecision extends Schema.TaggedClass<ReactorDecision>()('ReactorDecision', {
  target: RelationshipEndpoint,
  request: EntityReactionRequest,
  outcome: ReactorDecisionOutcome,
  reason: Schema.optional(Schema.String),
}) {}
export type ReactorDecision = typeof ReactorDecision.Type

export class ReactorPlan extends Schema.TaggedClass<ReactorPlan>()('ReactorPlan', {
  observation: ReactorObservation,
  decisions: Schema.Array(ReactorDecision),
}) {}
export type ReactorPlan = typeof ReactorPlan.Type

export class ReactorRun extends Schema.TaggedClass<ReactorRun>()('ReactorRun', {
  plan: ReactorPlan,
  results: Schema.Array(ReactorDecision),
}) {}
export type ReactorRun = typeof ReactorRun.Type

export class MachineWorkOrderCausalChain extends Schema.TaggedClass<MachineWorkOrderCausalChain>()('MachineWorkOrderCausalChain', {
  sourceMachineId: MachineId,
  sourcePropagationId: PropagationId,
  sourceTransitionId: Schema.String,
  sourceFromState: StateType,
  sourceToState: StateType,
  sourceTransitionedAt: Schema.DateFromSelf,
  sourceEventEntryId: Schema.optional(Schema.String),
  sourceEventTag: Schema.optional(Schema.String),
  sourceEventPrimaryKey: Schema.optional(Schema.String),
  sourceEventCreatedAt: Schema.optional(Schema.DateFromSelf),
  relationshipEdgeType: Schema.Literal('targets'),
  relationshipVerified: Schema.Boolean,
  targetWorkOrderId: WorkOrderId,
  targetTransitionId: Schema.String,
  targetFromState: WorkOrderStatus,
  targetToState: WorkOrderStatus,
  targetTransitionedAt: Schema.DateFromSelf,
  targetPropagationId: Schema.optional(PropagationId),
  causedByPropagationId: PropagationId,
}) {}

export class MachineWorkOrderCausalQuery extends Schema.TaggedClass<MachineWorkOrderCausalQuery>()('MachineWorkOrderCausalQuery', {
  machineId: Schema.optional(MachineId),
  propagationId: Schema.optional(PropagationId),
  startDate: Schema.optional(Schema.DateFromSelf),
  endDate: Schema.optional(Schema.DateFromSelf),
}) {}
