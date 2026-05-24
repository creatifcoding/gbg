import { describe, expect, it } from 'vitest'
import { Schema } from 'effect'
import { CONTEXT_EVENT_TAGS } from '../../schemas/events/operational/context-events'
import { STRUCTURAL_EVENT_TAGS } from '../../schemas/events/structural'
import {
  getInvalidRelationshipSetupEdges,
  getMissingRelationshipSetupEventTags,
  getRelationshipSetupMatrixEntry,
  RelationshipSetupMatrix,
  RelationshipSetupMatrixEntry,
} from '../../schemas/relationships'

describe('relationship setup matrix', () => {
  it('covers every structural and context event tag explicitly', () => {
    expect(getMissingRelationshipSetupEventTags()).toEqual([])

    const covered = new Set(RelationshipSetupMatrix.map((entry) => entry.eventTag))
    for (const tag of STRUCTURAL_EVENT_TAGS) expect(covered.has(tag)).toBe(true)
    for (const tag of CONTEXT_EVENT_TAGS) expect(covered.has(tag)).toBe(true)
  })

  it('only declares edges allowed by the relationship registry', () => {
    expect(getInvalidRelationshipSetupEdges()).toEqual([])
  })

  it('marks device hierarchy as a known registry gap instead of inventing an edge', () => {
    const created = getRelationshipSetupMatrixEntry('DeviceCreated')
    const decommissioned = getRelationshipSetupMatrixEntry('DeviceDecommissioned')

    expect(created?.status).toBe('blocked_by_registry')
    expect(created?.edges).toHaveLength(0)
    expect(decommissioned?.status).toBe('blocked_by_registry')
    expect(decommissioned?.edges).toHaveLength(0)
  })

  it('keeps context relationship setup projection-owned until Reactor policies are explicit', () => {
    const attached = getRelationshipSetupMatrixEntry('AssetAttached')
    const snapshot = getRelationshipSetupMatrixEntry('ContextSnapshotted')

    expect(attached?.jurisdiction).toBe('context_graph_projection')
    expect(attached?.reactorScope).toBe('reactor_candidate_after_projection')
    expect(attached?.edges.map((edge) => edge.edgeType)).toEqual(['targets'])
    expect(snapshot?.jurisdiction).toBe('audit_projection')
    expect(snapshot?.reactorScope).toBe('none')
  })

  it('round-trips entries through Effect Schema', () => {
    const decoded = Schema.decodeUnknownSync(RelationshipSetupMatrixEntry)(
      getRelationshipSetupMatrixEntry('ChildWorkOrderSpawned'),
    )

    expect(decoded.eventTag).toBe('ChildWorkOrderSpawned')
    expect(decoded.edges.map((edge) => edge.edgeType)).toEqual(['depends_on', 'caused_by'])
  })
})
