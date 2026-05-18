import { describe, expect, it } from 'vitest'
import { Schema } from 'effect'
import {
  getPropagationDescriptorsForEdge,
  getRelationshipEdgeDescriptor,
  MachineUnavailableSuspendsWorkOrder,
  PropagationDescriptor,
} from '../../schemas/relationships'

describe('relationship propagation descriptors', () => {
  it('attaches Machine unavailable → WorkOrder suspend descriptor to targets edge', () => {
    const edge = getRelationshipEdgeDescriptor('targets')
    const descriptors = getPropagationDescriptorsForEdge('targets')

    expect(edge.edgeType).toBe('targets')
    expect(descriptors).toHaveLength(1)
    expect(descriptors[0]).toBe(MachineUnavailableSuspendsWorkOrder)
    expect(descriptors[0]!.sourceEntityType).toBe('machine')
    expect(descriptors[0]!.targetEntityType).toBe('work_order')
    expect(descriptors[0]!.relationshipTraversal).toBe('target_to_source')
    expect(descriptors[0]!.sourcePredicate.eventTag).toBe('EquipmentStateChanged')
    expect(descriptors[0]!.sourcePredicate.states).toContain('planned_downtime')
    expect(descriptors[0]!.targetCommand.commandTag).toBe('WorkOrder.Suspend')
    expect(descriptors[0]!.targetCommand.reason).toBe('equipment_unavailable')
    expect(descriptors[0]!.idempotencyStrategy).toBe('source_propagation_id')
  })

  it('round-trips through the PropagationDescriptor schema', () => {
    const decoded = Schema.decodeUnknownSync(PropagationDescriptor)(MachineUnavailableSuspendsWorkOrder)
    expect(decoded.id).toBe('machine-unavailable-suspends-work-order')
  })
})
