/** Structural Reactor target contracts. */

import { Effect } from 'effect'
import {
  EntityCapabilityIds,
  RelationshipNodeTypes,
  type RelationshipNodeType,
  eligible,
} from '../../../schemas/relationships'
import type {
  EntityReactionCapability,
  EntityReactionContract,
} from '../declarations'

export const StructuralLifecycleEntityTypes = [
  RelationshipNodeTypes.Enterprise,
  RelationshipNodeTypes.Site,
  RelationshipNodeTypes.Area,
  RelationshipNodeTypes.Plant,
  RelationshipNodeTypes.Line,
  RelationshipNodeTypes.WorkCell,
  RelationshipNodeTypes.Machine,
  RelationshipNodeTypes.Sensor,
  RelationshipNodeTypes.Device,
] as const satisfies readonly RelationshipNodeType[]

const lifecycleInheritedCapability: EntityReactionCapability = {
  id: EntityCapabilityIds.LifecycleInherited,
  classify: (request) => Effect.succeed(eligible({
    entityType: request.target.type,
    entityId: request.target.id,
    currentState: 'projection_only',
    targetState: 'inherited_decommission_pressure',
  })),
  dispatch: (request) => Effect.succeed({
    target: request.target,
    source: request.source,
    policyId: request.policyId,
    capability: request.capability,
    outcome: 'projection_only_noop',
  }),
}

/**
 * Target-owned structural lifecycle contract.
 *
 * This deliberately records no graph mutation and emits no child StructuralEvent.
 * The bounded first promotion only proves that Reactor can route parent
 * decommission pressure to child structural targets without becoming the owner
 * of recursive cascade state.
 */
export const makeStructuralLifecycleInheritedContracts = (): readonly EntityReactionContract[] =>
  StructuralLifecycleEntityTypes.map((entityType) => ({
    entityType,
    capabilities: new Map([[EntityCapabilityIds.LifecycleInherited, lifecycleInheritedCapability]]),
  }))
