import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { ObservationSignal } from '../../../schemas/reactor'
import {
  EntityCapabilityIds,
  ContainsStructuralDecommissionInheritsTarget,
  DependsOnWorkOrderBlockedBlocksSource,
  DependsOnWorkOrderBlockRetractedReleasesSource,
  DependsOnWorkOrderSatisfiedSatisfiesSource,
  RequiresAlarmSafetyHoldHoldsSource,
  RequiresAlarmSafetyHoldRetractedReleasesSource,
  RequiresEquipmentUnavailableBlocksSource,
  RequiresStructuralDecommissionBlocksSource,
  TargetsAlarmSafetyHoldHoldsSource,
  TargetsAlarmSafetyHoldRetractedReleasesSource,
  TargetsMachineUnavailableBlocksSource,
  TargetsStructuralDecommissionBlocksSource,
  getPropagationPoliciesForEdge,
} from '../../../schemas/relationships'
import { eligible } from '../../../schemas/relationships/eligibility'
import { makeReactorRegistry, type EntityReactionContract } from '../ReactorRegistry'

const workOrderContract: EntityReactionContract = {
  entityType: 'work_order',
  capabilities: new Map([
    [EntityCapabilityIds.DependencyBlocked, {
      id: EntityCapabilityIds.DependencyBlocked,
      classify: (request) => Effect.succeed(eligible({
        entityType: 'work_order',
        entityId: request.target.id,
        targetState: 'suspended',
      })),
      dispatch: () => Effect.void,
    }],
  ]),
}

describe('ReactorRegistry', () => {
  it('matches all production equipment unavailable propagation policies by observation signal', () => {
    const registry = makeReactorRegistry({
      observations: [],
      propagationPolicies: [
        TargetsMachineUnavailableBlocksSource,
        RequiresEquipmentUnavailableBlocksSource,
      ],
      entities: [workOrderContract],
    })

    const policies = registry.policiesForSignal(new ObservationSignal({
      axis: 'equipment.availability',
      kind: 'condition_asserted',
      value: 'unavailable',
    }))

    expect(policies.map((policy) => policy.id)).toEqual([
      TargetsMachineUnavailableBlocksSource.id,
      RequiresEquipmentUnavailableBlocksSource.id,
    ])
  })

  it('registers production policies on their relationship edge descriptors', () => {
    expect(getPropagationPoliciesForEdge('targets').map((policy) => policy.id)).toContain(
      TargetsMachineUnavailableBlocksSource.id,
    )
    expect(getPropagationPoliciesForEdge('requires').map((policy) => policy.id)).toContain(
      RequiresEquipmentUnavailableBlocksSource.id,
    )
  })

  it('registers WorkOrder depends_on routing contract policies', () => {
    expect(getPropagationPoliciesForEdge('depends_on').map((policy) => policy.id)).toEqual([
      DependsOnWorkOrderBlockedBlocksSource.id,
      DependsOnWorkOrderSatisfiedSatisfiesSource.id,
      DependsOnWorkOrderBlockRetractedReleasesSource.id,
    ])
  })

  it('registers Alarm safety-hold routing contract policies on asset dependency edges', () => {
    expect(getPropagationPoliciesForEdge('targets').map((policy) => policy.id)).toEqual([
      TargetsMachineUnavailableBlocksSource.id,
      TargetsAlarmSafetyHoldHoldsSource.id,
      TargetsAlarmSafetyHoldRetractedReleasesSource.id,
      TargetsStructuralDecommissionBlocksSource.id,
    ])
    expect(getPropagationPoliciesForEdge('requires').map((policy) => policy.id)).toEqual([
      RequiresEquipmentUnavailableBlocksSource.id,
      RequiresAlarmSafetyHoldHoldsSource.id,
      RequiresAlarmSafetyHoldRetractedReleasesSource.id,
      RequiresStructuralDecommissionBlocksSource.id,
    ])
  })

  it('registers Structural decommission cascade routing policies', () => {
    expect(getPropagationPoliciesForEdge('contains').map((policy) => policy.id)).toEqual([
      ContainsStructuralDecommissionInheritsTarget.id,
    ])
    expect(getPropagationPoliciesForEdge('targets').map((policy) => policy.id)).toContain(
      TargetsStructuralDecommissionBlocksSource.id,
    )
    expect(getPropagationPoliciesForEdge('requires').map((policy) => policy.id)).toContain(
      RequiresStructuralDecommissionBlocksSource.id,
    )
  })

  it('matches Structural decommission signals through declared policies', () => {
    const registry = makeReactorRegistry({
      observations: [],
      propagationPolicies: [
        ContainsStructuralDecommissionInheritsTarget,
        TargetsStructuralDecommissionBlocksSource,
        RequiresStructuralDecommissionBlocksSource,
      ],
      entities: [workOrderContract],
    })

    expect(registry.policiesForSignal(new ObservationSignal({
      axis: 'structural.lifecycle',
      kind: 'condition_asserted',
      value: 'decommissioned',
    })).map((policy) => policy.id)).toEqual([
      ContainsStructuralDecommissionInheritsTarget.id,
      TargetsStructuralDecommissionBlocksSource.id,
      RequiresStructuralDecommissionBlocksSource.id,
    ])
  })

  it('matches Alarm safety-hold signals through declared policies', () => {
    const registry = makeReactorRegistry({
      observations: [],
      propagationPolicies: [
        TargetsAlarmSafetyHoldHoldsSource,
        RequiresAlarmSafetyHoldHoldsSource,
        TargetsAlarmSafetyHoldRetractedReleasesSource,
        RequiresAlarmSafetyHoldRetractedReleasesSource,
      ],
      entities: [workOrderContract],
    })

    expect(registry.policiesForSignal(new ObservationSignal({
      axis: 'alarm.safety',
      kind: 'condition_asserted',
      value: 'hold',
    })).map((policy) => policy.id)).toEqual([
      TargetsAlarmSafetyHoldHoldsSource.id,
      RequiresAlarmSafetyHoldHoldsSource.id,
    ])

    expect(registry.policiesForSignal(new ObservationSignal({
      axis: 'alarm.safety',
      kind: 'condition_retracted',
      value: 'hold',
    })).map((policy) => policy.id)).toEqual([
      TargetsAlarmSafetyHoldRetractedReleasesSource.id,
      RequiresAlarmSafetyHoldRetractedReleasesSource.id,
    ])
  })

  it('does not match unrelated signals', () => {
    const registry = makeReactorRegistry({
      observations: [],
      propagationPolicies: [TargetsMachineUnavailableBlocksSource],
      entities: [workOrderContract],
    })

    const policies = registry.policiesForSignal(new ObservationSignal({
      axis: 'equipment.availability',
      kind: 'condition_asserted',
      value: 'available',
    }))

    expect(policies).toHaveLength(0)
  })

  it('rejects duplicate propagation policy ids', () => {
    expect(() => makeReactorRegistry({
      observations: [],
      propagationPolicies: [TargetsMachineUnavailableBlocksSource, TargetsMachineUnavailableBlocksSource],
      entities: [workOrderContract],
    })).toThrow(/Duplicate Reactor registry propagation policy id/)
  })

  it('resolves entity capabilities by target entity type', () => {
    const registry = makeReactorRegistry({
      observations: [],
      propagationPolicies: [TargetsMachineUnavailableBlocksSource],
      entities: [workOrderContract],
    })

    const capability = registry.capabilityFor({
      entityType: 'work_order',
      capability: EntityCapabilityIds.DependencyBlocked,
    })

    expect(capability._tag).toBe('Some')
  })
})
