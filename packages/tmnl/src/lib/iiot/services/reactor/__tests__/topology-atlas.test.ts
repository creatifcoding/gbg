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
import { RELATIONSHIP_EDGE_REGISTRY } from '../../../schemas/relationships/edge-types'
import { ReactiveEquipmentStateObservationSpecs } from '../observations'
import {
  getEventRoutingContracts,
  getIiotEventGroupTags,
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
      targetCapabilities: ['dependency.blocked'],
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
      routingKind: 'audit_only',
      proofRequirements: ['documentation_only'],
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
  })
})
