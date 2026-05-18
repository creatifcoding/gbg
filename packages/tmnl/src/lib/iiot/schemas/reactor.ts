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
