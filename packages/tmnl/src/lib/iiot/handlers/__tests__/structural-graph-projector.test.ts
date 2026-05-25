import { describe, expect, it } from 'vitest'
import { Effect, Option } from 'effect'
import {
  makeStructuralGraphProjector,
  type StructuralGraphProjectionPort,
} from '../structural-handlers'

const makeGraph = () => {
  const calls = {
    nodes: [] as Array<{ endpoint: { type: string; id: string }; properties?: Record<string, unknown> }>,
    edges: [] as Array<{ source: { type: string; id: string }; target: { type: string; id: string }; edgeType: string; metadata: any }>,
    deletes: [] as Array<{ source: { type: string; id: string }; target: { type: string; id: string }; edgeType: string; reason?: string }>,
  }

  const graph: StructuralGraphProjectionPort = {
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

const base = {
  eventId: 'EVT-STRUCT-PROJECTOR-001',
  causedBy: 'structural-projector-test',
}

describe('Structural graph projector', () => {
  it('materializes upper hierarchy contains edges', async () => {
    const { graph, calls } = makeGraph()
    const projector = makeStructuralGraphProjector(graph)

    await Effect.runPromise(projector.projectSiteCreated({
      ...base,
      siteId: 'SIT-STRUCT-PROJECTOR-001',
      enterpriseId: 'ENT-STRUCT-PROJECTOR-001',
      name: 'Projected Site',
    }))

    expect(calls.nodes).toContainEqual({
      endpoint: { type: 'site', id: 'SIT-STRUCT-PROJECTOR-001' },
      properties: expect.objectContaining({ projected_from: 'StructuralEvents', name: 'Projected Site' }),
    })
    expect(calls.edges).toEqual([
      expect.objectContaining({
        source: { type: 'enterprise', id: 'ENT-STRUCT-PROJECTOR-001' },
        target: { type: 'site', id: 'SIT-STRUCT-PROJECTOR-001' },
        edgeType: 'contains',
      }),
    ])
  })

  it('prefers WorkCell parent for MachineCreated when present', async () => {
    const { graph, calls } = makeGraph()
    const projector = makeStructuralGraphProjector(graph)

    await Effect.runPromise(projector.projectMachineCreated({
      ...base,
      machineId: 'MCH-STRUCT-PROJECTOR-001',
      lineId: 'LIN-STRUCT-PROJECTOR-001',
      workCellId: Option.some('WCL-STRUCT-PROJECTOR-001'),
      name: 'Projected Machine',
    }))

    expect(calls.edges).toEqual([
      expect.objectContaining({
        source: { type: 'workcell', id: 'WCL-STRUCT-PROJECTOR-001' },
        target: { type: 'machine', id: 'MCH-STRUCT-PROJECTOR-001' },
        edgeType: 'contains',
      }),
    ])
  })

  it('falls back to Line parent for MachineCreated when WorkCell is absent', async () => {
    const { graph, calls } = makeGraph()
    const projector = makeStructuralGraphProjector(graph)

    await Effect.runPromise(projector.projectMachineCreated({
      ...base,
      machineId: 'MCH-STRUCT-PROJECTOR-002',
      lineId: 'LIN-STRUCT-PROJECTOR-002',
      workCellId: Option.none(),
      name: 'Projected Machine 2',
    }))

    expect(calls.edges[0]?.source).toEqual({ type: 'line', id: 'LIN-STRUCT-PROJECTOR-002' })
    expect(calls.edges[0]?.target).toEqual({ type: 'machine', id: 'MCH-STRUCT-PROJECTOR-002' })
  })

  it('relocates Machine by closing previous parent and opening new parent', async () => {
    const { graph, calls } = makeGraph()
    const projector = makeStructuralGraphProjector(graph)

    await Effect.runPromise(projector.projectMachineRelocated({
      ...base,
      machineId: 'MCH-STRUCT-PROJECTOR-003',
      previousLineId: 'LIN-OLD',
      previousWorkCellId: Option.none(),
      newLineId: 'LIN-NEW',
      newWorkCellId: Option.some('WCL-NEW'),
      reason: 'cell optimization',
    }))

    expect(calls.deletes).toEqual([
      {
        source: { type: 'line', id: 'LIN-OLD' },
        target: { type: 'machine', id: 'MCH-STRUCT-PROJECTOR-003' },
        edgeType: 'contains',
        reason: 'cell optimization',
      },
    ])
    expect(calls.edges[0]?.source).toEqual({ type: 'workcell', id: 'WCL-NEW' })
    expect(calls.edges[0]?.target).toEqual({ type: 'machine', id: 'MCH-STRUCT-PROJECTOR-003' })
  })

  it('materializes SensorCreated as monitors edge rather than contains', async () => {
    const { graph, calls } = makeGraph()
    const projector = makeStructuralGraphProjector(graph)

    await Effect.runPromise(projector.projectSensorCreated({
      ...base,
      sensorId: 'SNS-STRUCT-PROJECTOR-001',
      machineId: 'MCH-STRUCT-PROJECTOR-004',
      name: 'Projected Sensor',
    }))

    expect(calls.edges).toEqual([
      expect.objectContaining({
        source: { type: 'sensor', id: 'SNS-STRUCT-PROJECTOR-001' },
        target: { type: 'machine', id: 'MCH-STRUCT-PROJECTOR-004' },
        edgeType: 'monitors',
      }),
    ])
  })

  it('projects Device nodes without inventing an unregistered Machine -> Device edge', async () => {
    const { graph, calls } = makeGraph()
    const projector = makeStructuralGraphProjector(graph)

    await Effect.runPromise(projector.projectDeviceCreated({
      ...base,
      deviceId: 'DEV-STRUCT-PROJECTOR-001',
      machineId: 'MCH-STRUCT-PROJECTOR-005',
      name: 'Projected Device',
    }))

    expect(calls.nodes).toEqual([
      {
        endpoint: { type: 'device', id: 'DEV-STRUCT-PROJECTOR-001' },
        properties: expect.objectContaining({
          projected_from: 'StructuralEvents',
          name: 'Projected Device',
          parent_machine_id: 'MCH-STRUCT-PROJECTOR-005',
        }),
      },
    ])
    expect(calls.edges).toEqual([])
  })
})
