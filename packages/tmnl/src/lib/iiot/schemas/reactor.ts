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
  RelationshipEdgeType,
  RelationshipEndpoint,
} from './relationships/edge-types'

export const ReactorConsumerId = Schema.String.pipe(Schema.brand('ReactorConsumerId'))
export type ReactorConsumerId = typeof ReactorConsumerId.Type

export const ReactorSourceEntryId = Schema.String.pipe(Schema.brand('ReactorSourceEntryId'))
export type ReactorSourceEntryId = typeof ReactorSourceEntryId.Type

export const ReactorCheckpointOutcomes = {
  Processed: 'processed',
  Skipped: 'skipped',
  Failed: 'failed',
} as const

export const ReactorCheckpointOutcome = Schema.Literal(
  ReactorCheckpointOutcomes.Processed,
  ReactorCheckpointOutcomes.Skipped,
  ReactorCheckpointOutcomes.Failed,
)
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
// Reactor source-entry claim contracts
// =============================================================================

export const ReactorPolicyEpoch = Schema.String.pipe(Schema.brand('ReactorPolicyEpoch'))
export type ReactorPolicyEpoch = typeof ReactorPolicyEpoch.Type

export const ReactorRegistryFingerprint = Schema.String.pipe(Schema.brand('ReactorRegistryFingerprint'))
export type ReactorRegistryFingerprint = typeof ReactorRegistryFingerprint.Type

export const ReactorOwnerKey = Schema.String.pipe(Schema.brand('ReactorOwnerKey'))
export type ReactorOwnerKey = typeof ReactorOwnerKey.Type

export const ReactorClaimToken = Schema.String.pipe(Schema.brand('ReactorClaimToken'))
export type ReactorClaimToken = typeof ReactorClaimToken.Type

export const ReactorClaimStatuses = {
  Processing: 'processing',
  Completed: 'completed',
  Blocked: 'blocked',
  Deferred: 'deferred',
} as const

export const ReactorSourceClaimStatus = Schema.Literal(
  ReactorClaimStatuses.Processing,
  ReactorClaimStatuses.Completed,
  ReactorClaimStatuses.Blocked,
  ReactorClaimStatuses.Deferred,
)
export type ReactorSourceClaimStatus = typeof ReactorSourceClaimStatus.Type

export const ReactorClaimPhases = {
  Acquired: 'acquired',
  Planning: 'planning',
  Dispatching: 'dispatching',
  Completing: 'completing',
  Recovering: 'recovering',
} as const

export const ReactorClaimPhase = Schema.Literal(
  ReactorClaimPhases.Acquired,
  ReactorClaimPhases.Planning,
  ReactorClaimPhases.Dispatching,
  ReactorClaimPhases.Completing,
  ReactorClaimPhases.Recovering,
)
export type ReactorClaimPhase = typeof ReactorClaimPhase.Type

export const ReactorClaimAcquireTags = {
  Acquired: 'acquired',
  Reacquired: 'reacquired',
  Busy: 'busy',
  Deferred: 'deferred',
  Completed: 'completed',
  Blocked: 'blocked',
  EpochConflict: 'epoch_conflict',
  RegistryDrift: 'registry_drift',
} as const

export const ReactorClaimAcquireTag = Schema.Literal(
  ReactorClaimAcquireTags.Acquired,
  ReactorClaimAcquireTags.Reacquired,
  ReactorClaimAcquireTags.Busy,
  ReactorClaimAcquireTags.Deferred,
  ReactorClaimAcquireTags.Completed,
  ReactorClaimAcquireTags.Blocked,
  ReactorClaimAcquireTags.EpochConflict,
  ReactorClaimAcquireTags.RegistryDrift,
)
export type ReactorClaimAcquireTag = typeof ReactorClaimAcquireTag.Type

export class ReactorSourceClaim extends Schema.TaggedClass<ReactorSourceClaim>()('ReactorSourceClaim', {
  consumerId: ReactorConsumerId,
  sourceEntryId: ReactorSourceEntryId,
  sourceEvent: Schema.String,
  primaryKey: Schema.String,
  ownerKey: ReactorOwnerKey,
  policyEpoch: ReactorPolicyEpoch,
  registryFingerprint: ReactorRegistryFingerprint,
  claimStatus: ReactorSourceClaimStatus,
  claimToken: ReactorClaimToken,
  claimedBy: Schema.String,
  attempt: Schema.Number.pipe(Schema.int(), Schema.positive()),
  phase: ReactorClaimPhase,
  claimedAt: Schema.DateTimeUtcFromDate,
  heartbeatAt: Schema.DateTimeUtcFromDate,
  leaseExpiresAt: Schema.DateTimeUtcFromDate,
  attemptDeadlineAt: Schema.DateTimeUtcFromDate,
  phaseStartedAt: Schema.DateTimeUtcFromDate,
  nextRetryAt: Schema.optional(Schema.DateTimeUtcFromDate),
  completedAt: Schema.optional(Schema.DateTimeUtcFromDate),
  blockedAt: Schema.optional(Schema.DateTimeUtcFromDate),
  outcome: Schema.optional(ReactorCheckpointOutcome),
  conflictReason: Schema.optional(Schema.String),
  lastError: Schema.optional(Schema.String),
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
}) {}
export type ReactorSourceClaim = typeof ReactorSourceClaim.Type

export class ReactorClaimAcquireInput extends Schema.TaggedClass<ReactorClaimAcquireInput>()('ReactorClaimAcquireInput', {
  consumerId: ReactorConsumerId,
  sourceEntryId: ReactorSourceEntryId,
  sourceEvent: Schema.String,
  primaryKey: Schema.String,
  ownerKey: ReactorOwnerKey,
  policyEpoch: ReactorPolicyEpoch,
  registryFingerprint: ReactorRegistryFingerprint,
  claimedBy: Schema.String,
  claimToken: Schema.optional(ReactorClaimToken),
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}
export type ReactorClaimAcquireInput = typeof ReactorClaimAcquireInput.Type

export class ReactorClaimHeartbeatInput extends Schema.TaggedClass<ReactorClaimHeartbeatInput>()('ReactorClaimHeartbeatInput', {
  consumerId: ReactorConsumerId,
  sourceEntryId: ReactorSourceEntryId,
  claimToken: ReactorClaimToken,
  phase: ReactorClaimPhase,
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}
export type ReactorClaimHeartbeatInput = typeof ReactorClaimHeartbeatInput.Type

export class ReactorClaimCompleteInput extends Schema.TaggedClass<ReactorClaimCompleteInput>()('ReactorClaimCompleteInput', {
  consumerId: ReactorConsumerId,
  sourceEntryId: ReactorSourceEntryId,
  claimToken: ReactorClaimToken,
  outcome: ReactorCheckpointOutcome,
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}
export type ReactorClaimCompleteInput = typeof ReactorClaimCompleteInput.Type

export class ReactorClaimDeferInput extends Schema.TaggedClass<ReactorClaimDeferInput>()('ReactorClaimDeferInput', {
  consumerId: ReactorConsumerId,
  sourceEntryId: ReactorSourceEntryId,
  claimToken: ReactorClaimToken,
  nextRetryAt: Schema.DateTimeUtc,
  lastError: Schema.String,
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}
export type ReactorClaimDeferInput = typeof ReactorClaimDeferInput.Type

export class ReactorClaimBlockInput extends Schema.TaggedClass<ReactorClaimBlockInput>()('ReactorClaimBlockInput', {
  consumerId: ReactorConsumerId,
  sourceEntryId: ReactorSourceEntryId,
  claimToken: Schema.optional(ReactorClaimToken),
  conflictReason: Schema.String,
  lastError: Schema.optional(Schema.String),
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}
export type ReactorClaimBlockInput = typeof ReactorClaimBlockInput.Type

export class ReactorClaimFindExpiredInput extends Schema.TaggedClass<ReactorClaimFindExpiredInput>()('ReactorClaimFindExpiredInput', {
  policyEpoch: ReactorPolicyEpoch,
  registryFingerprint: ReactorRegistryFingerprint,
  claimedBy: Schema.String,
  batchSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
}) {}
export type ReactorClaimFindExpiredInput = typeof ReactorClaimFindExpiredInput.Type

export class ReactorSourceClaimConfig extends Schema.TaggedClass<ReactorSourceClaimConfig>()('ReactorSourceClaimConfig', {
  leaseDurationMs: Schema.Number.pipe(Schema.int(), Schema.positive()),
  heartbeatIntervalMs: Schema.Number.pipe(Schema.int(), Schema.positive()),
  attemptDeadlineMs: Schema.Number.pipe(Schema.int(), Schema.positive()),
  maxAttempts: Schema.Number.pipe(Schema.int(), Schema.positive()),
  deferRetryMs: Schema.Number.pipe(Schema.int(), Schema.positive()),
  lockTimeoutMs: Schema.Number.pipe(Schema.int(), Schema.positive()),
  sweeperBatchSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
}) {}
export type ReactorSourceClaimConfig = typeof ReactorSourceClaimConfig.Type

export const ReactorSourceClaimConfigDefaults = new ReactorSourceClaimConfig({
  leaseDurationMs: 30_000,
  heartbeatIntervalMs: 10_000,
  attemptDeadlineMs: 120_000,
  maxAttempts: 5,
  deferRetryMs: 30_000,
  lockTimeoutMs: 250,
  sweeperBatchSize: 25,
})

export const ReactorClaimAcquired = Schema.TaggedStruct('ReactorClaimAcquired', {
  claim: ReactorSourceClaim,
})
export type ReactorClaimAcquired = typeof ReactorClaimAcquired.Type

export const ReactorClaimReacquired = Schema.TaggedStruct('ReactorClaimReacquired', {
  claim: ReactorSourceClaim,
})
export type ReactorClaimReacquired = typeof ReactorClaimReacquired.Type

export const ReactorClaimBusy = Schema.TaggedStruct('ReactorClaimBusy', {
  claim: ReactorSourceClaim,
})
export type ReactorClaimBusy = typeof ReactorClaimBusy.Type

export const ReactorClaimDeferred = Schema.TaggedStruct('ReactorClaimDeferred', {
  claim: ReactorSourceClaim,
})
export type ReactorClaimDeferred = typeof ReactorClaimDeferred.Type

export const ReactorClaimCompleted = Schema.TaggedStruct('ReactorClaimCompleted', {
  claim: ReactorSourceClaim,
})
export type ReactorClaimCompleted = typeof ReactorClaimCompleted.Type

export const ReactorClaimBlocked = Schema.TaggedStruct('ReactorClaimBlocked', {
  claim: ReactorSourceClaim,
})
export type ReactorClaimBlocked = typeof ReactorClaimBlocked.Type

export const ReactorClaimEpochConflict = Schema.TaggedStruct('ReactorClaimEpochConflict', {
  claim: ReactorSourceClaim,
  requestedPolicyEpoch: ReactorPolicyEpoch,
})
export type ReactorClaimEpochConflict = typeof ReactorClaimEpochConflict.Type

export const ReactorClaimRegistryDrift = Schema.TaggedStruct('ReactorClaimRegistryDrift', {
  claim: ReactorSourceClaim,
  requestedRegistryFingerprint: ReactorRegistryFingerprint,
})
export type ReactorClaimRegistryDrift = typeof ReactorClaimRegistryDrift.Type

export const ReactorClaimAcquireResult = Schema.Union(
  ReactorClaimAcquired,
  ReactorClaimReacquired,
  ReactorClaimBusy,
  ReactorClaimDeferred,
  ReactorClaimCompleted,
  ReactorClaimBlocked,
  ReactorClaimEpochConflict,
  ReactorClaimRegistryDrift,
)
export type ReactorClaimAcquireResult = typeof ReactorClaimAcquireResult.Type

// =============================================================================
// Generic Reactor propagation contracts
// =============================================================================

export const ReactorRequestId = Schema.String.pipe(Schema.brand('ReactorRequestId'))
export type ReactorRequestId = typeof ReactorRequestId.Type

export const ReactorConstraintId = Schema.String.pipe(Schema.brand('ReactorConstraintId'))
export type ReactorConstraintId = typeof ReactorConstraintId.Type

export const ReactorConstraintFamilies = {
  Dependency: 'dependency',
  Safety: 'safety',
  Quality: 'quality',
  Approval: 'approval',
  Lifecycle: 'lifecycle',
  Capacity: 'capacity',
} as const

export const ReactorConstraintFamily = Schema.Literal(
  ReactorConstraintFamilies.Dependency,
  ReactorConstraintFamilies.Safety,
  ReactorConstraintFamilies.Quality,
  ReactorConstraintFamilies.Approval,
  ReactorConstraintFamilies.Lifecycle,
  ReactorConstraintFamilies.Capacity,
)
export type ReactorConstraintFamily = typeof ReactorConstraintFamily.Type

export const ReactorConstraintStates = {
  Asserted: 'asserted',
  Retracted: 'retracted',
  Superseded: 'superseded',
  Ignored: 'ignored',
} as const

export const ReactorConstraintState = Schema.Literal(
  ReactorConstraintStates.Asserted,
  ReactorConstraintStates.Retracted,
  ReactorConstraintStates.Superseded,
  ReactorConstraintStates.Ignored,
)
export type ReactorConstraintState = typeof ReactorConstraintState.Type

export const ReactorConstraintEffects = {
  Blocking: 'blocking',
  Holding: 'holding',
  Informational: 'informational',
  ReleaseCandidate: 'release_candidate',
} as const

export const ReactorConstraintEffect = Schema.Literal(
  ReactorConstraintEffects.Blocking,
  ReactorConstraintEffects.Holding,
  ReactorConstraintEffects.Informational,
  ReactorConstraintEffects.ReleaseCandidate,
)
export type ReactorConstraintEffect = typeof ReactorConstraintEffect.Type

export const TargetReleaseVerdicts = {
  Released: 'released',
  ConstraintRetracted: 'constraint_retracted',
  ActiveHoldsRemaining: 'active_holds_remaining',
  Idempotent: 'idempotent',
  UnknownConstraint: 'unknown_constraint',
  ManualHold: 'manual_hold',
  SafetyHold: 'safety_hold',
  TerminalState: 'terminal_state',
  InvalidTransition: 'invalid_transition',
  Deferred: 'deferred',
  Failed: 'failed',
} as const

export const TargetReleaseVerdict = Schema.Literal(
  TargetReleaseVerdicts.Released,
  TargetReleaseVerdicts.ConstraintRetracted,
  TargetReleaseVerdicts.ActiveHoldsRemaining,
  TargetReleaseVerdicts.Idempotent,
  TargetReleaseVerdicts.UnknownConstraint,
  TargetReleaseVerdicts.ManualHold,
  TargetReleaseVerdicts.SafetyHold,
  TargetReleaseVerdicts.TerminalState,
  TargetReleaseVerdicts.InvalidTransition,
  TargetReleaseVerdicts.Deferred,
  TargetReleaseVerdicts.Failed,
)
export type TargetReleaseVerdict = typeof TargetReleaseVerdict.Type

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

export class ReactorConstraintIdentity extends Schema.TaggedClass<ReactorConstraintIdentity>()('ReactorConstraintIdentity', {
  constraintId: ReactorConstraintId,
  target: RelationshipEndpoint,
  capability: EntityCapabilityId,
  family: ReactorConstraintFamily,
  source: RelationshipEndpoint,
  relationshipEdgeType: RelationshipEdgeType,
  policyId: PropagationPolicyId,
  policyVersion: Schema.String,
  policyEpoch: ReactorPolicyEpoch,
  registryFingerprint: ReactorRegistryFingerprint,
  sourceEntryId: ReactorSourceEntryId,
  sourceEvent: Schema.String,
  propagationId: PropagationId,
}) {}
export type ReactorConstraintIdentity = typeof ReactorConstraintIdentity.Type

export class ReactorConstraintRecord extends Schema.TaggedClass<ReactorConstraintRecord>()('ReactorConstraintRecord', {
  identity: ReactorConstraintIdentity,
  state: ReactorConstraintState,
  effect: ReactorConstraintEffect,
  assertedAt: Schema.DateTimeUtcFromDate,
  retractedAt: Schema.optional(Schema.DateTimeUtcFromDate),
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}
export type ReactorConstraintRecord = typeof ReactorConstraintRecord.Type

export class ReactorConstraintNaturalAddress extends Schema.TaggedClass<ReactorConstraintNaturalAddress>()('ReactorConstraintNaturalAddress', {
  target: RelationshipEndpoint,
  capability: EntityCapabilityId,
  source: RelationshipEndpoint,
  relationshipEdgeType: RelationshipEdgeType,
  policyId: PropagationPolicyId,
  propagationId: PropagationId,
}) {}
export type ReactorConstraintNaturalAddress = typeof ReactorConstraintNaturalAddress.Type

export class ReactorConstraintAssertion extends Schema.TaggedClass<ReactorConstraintAssertion>()('ReactorConstraintAssertion', {
  target: RelationshipEndpoint,
  capability: EntityCapabilityId,
  family: ReactorConstraintFamily,
  source: RelationshipEndpoint,
  relationshipEdgeType: RelationshipEdgeType,
  policyId: PropagationPolicyId,
  policyVersion: Schema.String,
  policyEpoch: ReactorPolicyEpoch,
  registryFingerprint: ReactorRegistryFingerprint,
  sourceEntryId: ReactorSourceEntryId,
  sourceEvent: Schema.String,
  propagationId: PropagationId,
  effect: ReactorConstraintEffect,
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}
export type ReactorConstraintAssertion = typeof ReactorConstraintAssertion.Type

export class ReactorConstraintRetraction extends Schema.TaggedClass<ReactorConstraintRetraction>()('ReactorConstraintRetraction', {
  target: RelationshipEndpoint,
  capability: EntityCapabilityId,
  constraintId: Schema.optional(ReactorConstraintId),
  naturalAddress: Schema.optional(ReactorConstraintNaturalAddress),
  effect: ReactorConstraintEffect,
  signal: ObservationSignal,
  causality: ReactorCausality,
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}
export type ReactorConstraintRetraction = typeof ReactorConstraintRetraction.Type

export const ReactorConstraintRetractionPayload = Schema.Struct({
  constraintId: Schema.optional(ReactorConstraintId),
  naturalAddress: Schema.optional(ReactorConstraintNaturalAddress),
  effect: Schema.optional(ReactorConstraintEffect),
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
})
export type ReactorConstraintRetractionPayload = typeof ReactorConstraintRetractionPayload.Type

export class TargetConstraintReconciliationRequest extends Schema.TaggedClass<TargetConstraintReconciliationRequest>()('TargetConstraintReconciliationRequest', {
  target: RelationshipEndpoint,
  capability: EntityCapabilityId,
  constraint: ReactorConstraintIdentity,
  requestedState: ReactorConstraintState,
  effect: ReactorConstraintEffect,
  signal: ObservationSignal,
  causality: ReactorCausality,
  payload: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}
export type TargetConstraintReconciliationRequest = typeof TargetConstraintReconciliationRequest.Type

export class TargetConstraintReconciliationResult extends Schema.TaggedClass<TargetConstraintReconciliationResult>()('TargetConstraintReconciliationResult', {
  target: RelationshipEndpoint,
  capability: EntityCapabilityId,
  constraintId: Schema.optional(ReactorConstraintId),
  verdict: TargetReleaseVerdict,
  activeConstraintCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  targetState: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String),
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}
export type TargetConstraintReconciliationResult = typeof TargetConstraintReconciliationResult.Type

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
