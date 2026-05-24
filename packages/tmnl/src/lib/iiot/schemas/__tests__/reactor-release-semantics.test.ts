import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import { PropagationId } from '../identifiers'
import {
  EntityCapabilityIds,
  RelationshipEndpoint,
} from '../relationships'
import {
  ObservationSignal,
  ReactorCausality,
  ReactorConstraintAssertion,
  ReactorConstraintIdentity,
  ReactorConstraintNaturalAddress,
  ReactorConstraintRecord,
  ReactorConstraintRetraction,
  ReactorConstraintState,
  TargetConstraintReconciliationRequest,
  TargetConstraintReconciliationResult,
  TargetReleaseVerdict,
  type ReactorPolicyEpoch,
  type ReactorRegistryFingerprint,
} from '../reactor'

const target = new RelationshipEndpoint({ type: 'work_order', id: 'WO-RELEASE-001' })
const source = new RelationshipEndpoint({ type: 'machine', id: 'MCH-RELEASE-001' })

const causality = new ReactorCausality({
  propagationId: 'PROP-RELEASE-001' as PropagationId,
})

const signal = new ObservationSignal({
  axis: 'equipment.availability',
  kind: 'condition_retracted',
  value: 'available',
  previousValue: 'unavailable',
  reason: 'fault_cleared',
})

const constraint = new ReactorConstraintIdentity({
  constraintId: 'constraint:WO-RELEASE-001:PROP-RELEASE-001' as never,
  target,
  capability: EntityCapabilityIds.DependencyReleased,
  family: 'dependency',
  source,
  relationshipEdgeType: 'requires',
  policyId: 'requires.equipment-available.releases-source' as never,
  policyVersion: '1',
  policyEpoch: 'reactor-policy-epoch.test' as ReactorPolicyEpoch,
  registryFingerprint: 'fnv1a32:test' as ReactorRegistryFingerprint,
  sourceEntryId: 'journal-entry-release-001' as never,
  sourceEvent: 'FaultCleared',
  propagationId: 'PROP-RELEASE-001' as PropagationId,
})

describe('Reactor target-owned release semantics schemas', () => {
  it('decodes constraint state and release verdict vocabularies', () => {
    expect(Schema.decodeUnknownSync(ReactorConstraintState)('asserted')).toBe('asserted')
    expect(Schema.decodeUnknownSync(ReactorConstraintState)('retracted')).toBe('retracted')
    expect(Schema.decodeUnknownSync(TargetReleaseVerdict)('active_holds_remaining')).toBe('active_holds_remaining')
    expect(() => Schema.decodeUnknownSync(TargetReleaseVerdict)('resume_now')).toThrow()
  })

  it('represents a release constraint as target-owned reconciliation input', () => {
    const request = new TargetConstraintReconciliationRequest({
      target,
      capability: EntityCapabilityIds.DependencyReleased,
      constraint,
      requestedState: 'retracted',
      effect: 'release_candidate',
      signal,
      causality,
      payload: { relationshipEdgeType: 'requires' },
    })

    const decoded = Schema.decodeUnknownSync(TargetConstraintReconciliationRequest)(request)

    expect(decoded.target.type).toBe('work_order')
    expect(decoded.constraint.sourceEvent).toBe('FaultCleared')
    expect(decoded.constraint.source.type).toBe('machine')
    expect(decoded.constraint.family).toBe('dependency')
    expect(decoded.requestedState).toBe('retracted')
  })

  it('represents SQL-first assertion and retraction commands without caller-built ids', () => {
    const assertion = new ReactorConstraintAssertion({
      target,
      capability: EntityCapabilityIds.DependencyBlocked,
      family: 'dependency',
      source,
      relationshipEdgeType: 'requires',
      policyId: 'requires.equipment-unavailable.blocks-source' as never,
      policyVersion: '1',
      policyEpoch: 'reactor-policy-epoch.test' as ReactorPolicyEpoch,
      registryFingerprint: 'fnv1a32:test' as ReactorRegistryFingerprint,
      sourceEntryId: 'journal-entry-block-001' as never,
      sourceEvent: 'FaultDetected',
      propagationId: 'PROP-BLOCK-001' as PropagationId,
      effect: 'blocking',
    })
    const naturalAddress = new ReactorConstraintNaturalAddress({
      target: assertion.target,
      capability: assertion.capability,
      source: assertion.source,
      relationshipEdgeType: assertion.relationshipEdgeType,
      policyId: assertion.policyId,
      propagationId: assertion.propagationId,
    })
    const retraction = new ReactorConstraintRetraction({
      target,
      capability: EntityCapabilityIds.DependencyReleased,
      naturalAddress,
      effect: 'release_candidate',
      signal,
      causality,
    })

    const decodedAssertion = Schema.decodeUnknownSync(ReactorConstraintAssertion)(assertion)
    const decodedRetraction = Schema.decodeUnknownSync(ReactorConstraintRetraction)(retraction)

    expect('constraintId' in decodedAssertion).toBe(false)
    expect(decodedRetraction.naturalAddress?.policyId).toBe(assertion.policyId)
  })

  it('records active-hold verdicts without implying an inverse transition', () => {
    const now = new Date()
    const record = {
      _tag: 'ReactorConstraintRecord',
      identity: constraint,
      state: 'retracted',
      effect: 'release_candidate',
      assertedAt: now,
      retractedAt: now,
    }

    const result = new TargetConstraintReconciliationResult({
      target,
      capability: EntityCapabilityIds.DependencyReleased,
      constraintId: constraint.constraintId,
      verdict: 'active_holds_remaining',
      activeConstraintCount: 2,
      targetState: 'suspended',
      reason: 'quality hold remains active',
    })

    expect(Schema.decodeUnknownSync(ReactorConstraintRecord)(record).state).toBe('retracted')
    expect(Schema.decodeUnknownSync(TargetConstraintReconciliationResult)(result)).toMatchObject({
      verdict: 'active_holds_remaining',
      activeConstraintCount: 2,
      targetState: 'suspended',
    })
  })
})
