import { describe, expect, it } from 'vitest'
import {
  AlarmEvents,
  ApprovalEvents,
  BatchEvents,
  ContextEvents,
  EquipmentStateEvents,
  OperationalEvents,
  OperatorEvents,
  QualityEvents,
  StructuralEvents,
  TaskEvents,
  WorkOrderEvents,
} from '../../../schemas/events/groups'
import {
  EntityCapabilityIds,
  KNOWN_ENTITY_CAPABILITY_IDS,
  RELATIONSHIP_EDGE_REGISTRY,
} from '../../../schemas/relationships/edge-types'
import { ReactiveEquipmentStateObservationSpecs } from '../observations'
import {
  EXPLICIT_EVENT_ROUTING_CONTRACT_TAGS,
  getEventRoutingContracts,
  getIiotEventGroupTags,
  getReactorLaneReadinessEntries,
  getReactorTopologyAtlas,
} from '../topology-atlas'

const EVENT_GROUPS = {
  StructuralEvents,
  OperationalEvents,
  AlarmEvents,
  EquipmentStateEvents,
  WorkOrderEvents,
  ContextEvents,
  TaskEvents,
  ApprovalEvents,
  BatchEvents,
  QualityEvents,
  OperatorEvents,
} as const

describe('Reactor topology atlas', () => {
  it('enumerates every durable IIoT EventGroup tag exactly once', () => {
    const atlas = getReactorTopologyAtlas('2026-05-19T00:00:00.000Z')
    const expectedKeys = Object.entries(EVENT_GROUPS).flatMap(([group, eventGroup]) =>
      Object.keys((eventGroup as { events: Record<string, unknown> }).events)
        .map((tag) => `${group}:${tag}`),
    ).sort()
    const actualKeys = atlas.eventCoverage
      .map((entry) => `${entry.group}:${entry.tag}`)
      .sort()

    expect(actualKeys).toEqual(expectedKeys)
    expect(atlas.stats.eventTagCount).toBe(expectedKeys.length)
  })

  it('keeps the group-tag index in sync with EventGroup runtime metadata', () => {
    const groupTags = getIiotEventGroupTags()

    for (const [group, eventGroup] of Object.entries(EVENT_GROUPS)) {
      expect(groupTags[group as keyof typeof groupTags]).toEqual(
        Object.keys((eventGroup as { events: Record<string, unknown> }).events)
          .sort((a, b) => a.localeCompare(b)),
      )
    }
  })

  it('connects production observation specs to reactive event coverage', () => {
    const atlas = getReactorTopologyAtlas('2026-05-19T00:00:00.000Z')
    const expectedTags = ReactiveEquipmentStateObservationSpecs
      .map((spec) => spec.eventTag)
      .sort()
    const actualTags = atlas.eventCoverage
      .filter((entry) => entry.productionObservationIds.length > 0)
      .map((entry) => entry.tag)
      .sort()

    expect(actualTags).toEqual(expectedTags)

    for (const tag of expectedTags) {
      const entry = atlas.eventCoverage.find((candidate) => candidate.tag === tag)
      expect(entry?.status).toBe('reactive')
      expect(entry?.productionPolicyIds).toEqual([
        'targets.machine-unavailable.blocks-source',
        'requires.equipment-unavailable.blocks-source',
      ])
    }
  })

  it('derives Event Routing Contracts for every event coverage entry', () => {
    const atlas = getReactorTopologyAtlas('2026-05-19T00:00:00.000Z')
    const contracts = getEventRoutingContracts()

    expect(atlas.eventRoutingContracts).toEqual(contracts)
    expect(contracts).toHaveLength(atlas.eventCoverage.length)

    const maintenance = contracts.find((contract) => contract.eventTag === 'MaintenanceModeEntered')
    expect(maintenance).toMatchObject({
      id: 'EquipmentStateEvents.MaintenanceModeEntered',
      status: 'reactive',
      routingKind: 'reactor_dispatch',
      targetOwner: 'work_order',
      targetCapabilities: [EntityCapabilityIds.DependencyBlocked],
      productionPolicyIds: [
        'targets.machine-unavailable.blocks-source',
        'requires.equipment-unavailable.blocks-source',
      ],
      proofRequirements: [
        'observation_decode_test',
        'registry_policy_test',
        'graph_expansion_test',
        'source_claim_e2e',
        'target_contract_test',
      ],
    })
    expect(maintenance?.subject).toMatchObject({ entityType: 'machine' })
    expect(maintenance?.relationshipPaths[0]?.edgeTypes).toEqual(['targets', 'requires'])

    const created = contracts.find((contract) => contract.eventTag === 'EnterpriseCreated')
    expect(created).toMatchObject({
      status: 'non_reactive',
      routingKind: 'relationship_projection',
      proofRequirements: ['projection_handler_test', 'graph_expansion_test'],
    })
  })

  it('requires explicit ERC seeds for every durable IIoT event', () => {
    const explicitTags = new Set(EXPLICIT_EVENT_ROUTING_CONTRACT_TAGS)
    const requiredTags = Object.values(EVENT_GROUPS)
      .flatMap((eventGroup) => Object.keys((eventGroup as { events: Record<string, unknown> }).events))

    expect(EXPLICIT_EVENT_ROUTING_CONTRACT_TAGS).toHaveLength(requiredTags.length)
    for (const tag of requiredTags) {
      expect(explicitTags.has(tag), `${tag} should have an explicit ERC seed`).toBe(true)
    }

    const contracts = getEventRoutingContracts()
    const plantDecommissioned = contracts.find((contract) => contract.eventTag === 'PlantDecommissioned')
    expect(plantDecommissioned).toMatchObject({
      status: 'candidate',
      routingKind: 'candidate_dispatch',
      targetOwner: 'structural_entity/work_order',
      targetCapabilities: [EntityCapabilityIds.LifecycleInherited, EntityCapabilityIds.DependencyBlocked],
    })
    expect(plantDecommissioned?.relationshipPaths[0]?.edgeTypes).toEqual(['contains', 'targets', 'requires'])

    const sensorThresholdChanged = contracts.find((contract) => contract.eventTag === 'SensorThresholdChanged')
    expect(sensorThresholdChanged).toMatchObject({
      status: 'non_reactive',
      routingKind: 'relationship_projection',
      proofRequirements: ['projection_handler_test', 'graph_expansion_test'],
    })

    const workOrderCreated = contracts.find((contract) => contract.eventTag === 'WorkOrderCreated')
    expect(workOrderCreated).toMatchObject({
      status: 'candidate',
      routingKind: 'candidate_projection',
      subject: { entityType: 'work_order' },
      proofRequirements: ['projection_handler_test', 'graph_expansion_test'],
    })

    const operatorLogin = contracts.find((contract) => contract.eventTag === 'OperatorLogin')
    expect(operatorLogin).toMatchObject({
      status: 'non_reactive',
      routingKind: 'audit_only',
      proofRequirements: ['documentation_only'],
    })

    const knownCapabilities = new Set(KNOWN_ENTITY_CAPABILITY_IDS)
    for (const contract of contracts) {
      for (const capability of contract.targetCapabilities) {
        expect(
          knownCapabilities.has(capability),
          `${contract.id} references unknown capability ${capability}`,
        ).toBe(true)
      }
    }
  })

  it('derives lane readiness for production, candidate, and parked routes', () => {
    const atlas = getReactorTopologyAtlas('2026-05-19T00:00:00.000Z')
    const readiness = getReactorLaneReadinessEntries()

    expect(atlas.laneReadiness).toEqual(readiness)
    expect(readiness).toHaveLength(atlas.eventRoutingContracts.length)
    expect(atlas.stats.productionLaneCount).toBe(
      readiness.filter((entry) => entry.readiness === 'production').length,
    )
    expect(atlas.stats.candidateLaneCount).toBe(
      readiness.filter((entry) => entry.readiness === 'candidate').length,
    )
    expect(atlas.stats.parkedLaneCount).toBe(
      readiness.filter((entry) => entry.readiness === 'parked').length,
    )

    const maintenance = readiness.find((entry) => entry.eventTag === 'MaintenanceModeEntered')
    expect(maintenance).toMatchObject({
      readiness: 'production',
      activationGroups: ['baseline-live'],
      declaredObservationIds: ['maintenance-mode-entered-observation'],
      liveObservationIds: ['maintenance-mode-entered-observation'],
      declaredPolicyIds: [
        'requires.equipment-unavailable.blocks-source',
        'targets.machine-unavailable.blocks-source',
      ],
      livePolicyIds: [
        'requires.equipment-unavailable.blocks-source',
        'targets.machine-unavailable.blocks-source',
      ],
      requiredProofs: [
        'observation_decode_test',
        'registry_policy_test',
        'graph_expansion_test',
        'source_claim_e2e',
        'target_contract_test',
      ],
    })

    const workOrderSuspended = readiness.find((entry) => entry.eventTag === 'WorkOrderSuspended')
    expect(workOrderSuspended).toMatchObject({
      readiness: 'candidate',
      activationGroups: ['work-order-depends-on'],
      declaredObservationIds: ['work-order-suspended-dependency-observation'],
      liveObservationIds: [],
      declaredPolicyIds: ['depends_on.work-order-blocked.blocks-source'],
      livePolicyIds: [],
      requiredProofs: [
        'observation_decode_test',
        'registry_policy_test',
        'graph_expansion_test',
        'target_contract_test',
        'source_claim_e2e',
      ],
    })

    const operatorLogin = readiness.find((entry) => entry.eventTag === 'OperatorLogin')
    expect(operatorLogin).toMatchObject({
      readiness: 'parked',
      activationGroups: ['parked'],
      declaredObservationIds: [],
      declaredPolicyIds: [],
      requiredProofs: ['documentation_only'],
    })
  })

  it('enumerates every relationship registry edge and mirrors production policies', () => {
    const atlas = getReactorTopologyAtlas('2026-05-19T00:00:00.000Z')
    const expectedEdges = Object.keys(RELATIONSHIP_EDGE_REGISTRY).sort()
    const actualEdges = atlas.relationshipCoverage.map((entry) => entry.edgeType).sort()

    expect(actualEdges).toEqual(expectedEdges)

    for (const entry of atlas.relationshipCoverage) {
      const descriptor = RELATIONSHIP_EDGE_REGISTRY[entry.edgeType]
      expect(entry.allowedSourceTypes).toEqual(descriptor.allowedSourceTypes)
      expect(entry.allowedTargetTypes).toEqual(descriptor.allowedTargetTypes)
      expect(entry.allowedPairCount).toBe(
        descriptor.allowedSourceTypes.length * descriptor.allowedTargetTypes.length,
      )
      expect(entry.productionPolicyIds).toEqual(
        descriptor.propagationPolicies.map((policy) => policy.id),
      )
    }

    const targets = atlas.relationshipCoverage.find((entry) => entry.edgeType === 'targets')
    expect(targets?.livePolicyIds).toEqual(['targets.machine-unavailable.blocks-source'])

    const requires = atlas.relationshipCoverage.find((entry) => entry.edgeType === 'requires')
    expect(requires?.livePolicyIds).toEqual(['requires.equipment-unavailable.blocks-source'])
    expect(atlas.stats.registeredPolicyCount).toBe(
      atlas.relationshipCoverage.reduce((total, entry) => total + entry.productionPolicyIds.length, 0),
    )
    expect(atlas.stats.productionPolicyCount).toBe(2)
  })
})
