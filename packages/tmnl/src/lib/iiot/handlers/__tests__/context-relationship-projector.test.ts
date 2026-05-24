import { describe, expect, it } from 'vitest'
import { Effect, Option } from 'effect'
import type { AssetId } from '../../schemas/identifiers'
import {
  makeContextRelationshipProjector,
  resolveRelationshipNodeTypeFromAssetId,
  selectExternalRefRelationship,
  type RelationshipGraphProjectionPort,
} from '../context-handlers'

const makeGraph = () => {
  const calls = {
    nodes: [] as Array<{ endpoint: { type: string; id: string }; properties?: Record<string, unknown> }>,
    edges: [] as Array<{ source: { type: string; id: string }; target: { type: string; id: string }; edgeType: string; metadata: any }>,
    deletes: [] as Array<{ source: { type: string; id: string }; target: { type: string; id: string }; edgeType: string; reason?: string }>,
  }

  const graph: RelationshipGraphProjectionPort = {
    upsertRelationshipNode: (endpoint, properties) => Effect.sync(() => {
      calls.nodes.push({ endpoint, properties })
    }),
    upsertRelationshipEdge: (input) => Effect.sync(() => {
      calls.edges.push(input)
    }),
    softDeleteRelationshipEdge: (input) => Effect.sync(() => {
      calls.deletes.push(input)
    }),
  }

  return { graph, calls }
}

const basePayload = {
  eventId: 'EVT-CONTEXT-PROJECTOR-001',
  causedBy: 'context-projector-test',
  workOrderId: 'WO-CONTEXT-PROJECTOR-001',
  contextId: 'CTX-CONTEXT-PROJECTOR-001',
}

describe('Context relationship projector', () => {
  it('resolves known asset prefixes into relationship node types', () => {
    expect(resolveRelationshipNodeTypeFromAssetId('MCH-001')).toBe('machine')
    expect(resolveRelationshipNodeTypeFromAssetId('LIN-001')).toBe('line')
    expect(resolveRelationshipNodeTypeFromAssetId('PLT-001')).toBe('plant')
    expect(resolveRelationshipNodeTypeFromAssetId('UNKNOWN-001')).toBeUndefined()
  })

  it('materializes AssetAttached primary targets as WorkOrder -> asset targets edges', async () => {
    const { graph, calls } = makeGraph()
    const projector = makeContextRelationshipProjector(graph)

    await Effect.runPromise(projector.projectAssetAttached({
      ...basePayload,
      attachedAssetId: 'MCH-CONTEXT-PROJECTOR-001' as AssetId,
      assetRole: 'primary_target',
      notes: Option.some('primary asset'),
    }))

    expect(calls.nodes.map((call) => call.endpoint)).toEqual([
      { type: 'work_order', id: basePayload.workOrderId },
      { type: 'machine', id: 'MCH-CONTEXT-PROJECTOR-001' },
    ])
    expect(calls.edges).toHaveLength(1)
    expect(calls.edges[0]?.edgeType).toBe('targets')
    expect(calls.edges[0]?.source).toEqual({ type: 'work_order', id: basePayload.workOrderId })
    expect(calls.edges[0]?.target).toEqual({ type: 'machine', id: 'MCH-CONTEXT-PROJECTOR-001' })
    expect(calls.edges[0]?.metadata.context.eventTag).toBe('AssetAttached')
    expect(calls.edges[0]?.metadata.context.assetRole).toBe('primary_target')
  })

  it('soft-closes AssetDetached target edges', async () => {
    const { graph, calls } = makeGraph()
    const projector = makeContextRelationshipProjector(graph)

    await Effect.runPromise(projector.projectAssetDetached({
      ...basePayload,
      detachedAssetId: 'LIN-CONTEXT-PROJECTOR-001' as AssetId,
      reason: 'work_complete',
      notes: Option.none(),
    }))

    expect(calls.deletes).toEqual([
      {
        source: { type: 'work_order', id: basePayload.workOrderId },
        target: { type: 'line', id: 'LIN-CONTEXT-PROJECTOR-001' },
        edgeType: 'targets',
        reason: 'work_complete',
      },
    ])
  })

  it('materializes child WorkOrder topology as depends_on and caused_by edges', async () => {
    const { graph, calls } = makeGraph()
    const projector = makeContextRelationshipProjector(graph)

    await Effect.runPromise(projector.projectChildWorkOrderSpawned({
      ...basePayload,
      childWorkOrderId: 'WO-CONTEXT-PROJECTOR-CHILD-001',
      childType: 'corrective_maintenance',
      reason: 'follow-up repair',
      inheritAssets: true,
      inheritResources: false,
    }))

    expect(calls.nodes.map((call) => call.endpoint)).toContainEqual({
      type: 'work_order',
      id: 'WO-CONTEXT-PROJECTOR-CHILD-001',
    })
    expect(calls.edges.map((call) => call.edgeType)).toEqual(['depends_on', 'caused_by'])
    expect(calls.edges[0]?.source.id).toBe(basePayload.workOrderId)
    expect(calls.edges[0]?.target.id).toBe('WO-CONTEXT-PROJECTOR-CHILD-001')
    expect(calls.edges[1]?.source.id).toBe('WO-CONTEXT-PROJECTOR-CHILD-001')
    expect(calls.edges[1]?.target.id).toBe(basePayload.workOrderId)
  })

  it('maps external refs to requires or produces relationships', async () => {
    expect(selectExternalRefRelationship('purchase_order')).toBe('requires')
    expect(selectExternalRefRelationship('repair_report')).toBe('produces')

    const { graph, calls } = makeGraph()
    const projector = makeContextRelationshipProjector(graph)

    await Effect.runPromise(projector.projectExternalRefLinked({
      ...basePayload,
      externalRefId: 'EXT-CONTEXT-PROJECTOR-001',
      externalSystem: 'CMMS',
      externalType: 'repair_report',
      externalIdentifier: 'RR-001',
    }))

    expect(calls.edges).toHaveLength(1)
    expect(calls.edges[0]?.edgeType).toBe('produces')
    expect(calls.edges[0]?.target).toEqual({ type: 'external', id: 'EXT-CONTEXT-PROJECTOR-001' })
  })

  it('materializes resource allocation as an external requirement', async () => {
    const { graph, calls } = makeGraph()
    const projector = makeContextRelationshipProjector(graph)

    await Effect.runPromise(projector.projectResourceAllocated({
      ...basePayload,
      resourceId: 'RES-CONTEXT-PROJECTOR-001',
      resourceType: 'tool',
      resourceName: 'Torque Wrench',
      allocatedBy: 'tech-001',
    }))

    expect(calls.edges).toHaveLength(1)
    expect(calls.edges[0]?.edgeType).toBe('requires')
    expect(calls.edges[0]?.target).toEqual({ type: 'external', id: 'RES-CONTEXT-PROJECTOR-001' })
    expect(calls.edges[0]?.metadata.context.resourceType).toBe('tool')
  })
})
