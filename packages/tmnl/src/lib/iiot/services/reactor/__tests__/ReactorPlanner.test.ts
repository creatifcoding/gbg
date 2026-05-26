import { DateTime, Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import type { PropagationId } from '../../../schemas/identifiers'
import {
  EntityCapabilityIds,
  DependsOnWorkOrderBlockRetractedReleasesSource,
  RelationshipEndpoint,
} from '../../../schemas/relationships'
import {
  ObservationSignal,
  ReactorCausality,
  ReactorConstraintNaturalAddress,
  ReactorEventEnvelope,
  ReactorObservation,
} from '../../../schemas/reactor'
import { GraphClient } from '../../l1/GraphClient'
import { eligible } from '../../../schemas/relationships/eligibility'
import { ReactorPlanner, ReactorPlannerLive } from '../ReactorPlanner'
import { ReactorRegistryLayer, type EntityReactionContract } from '../ReactorRegistry'

const upstream = new RelationshipEndpoint({ type: 'work_order', id: 'WO-UPSTREAM-PLANNER' })
const downstream = new RelationshipEndpoint({ type: 'work_order', id: 'WO-DOWNSTREAM-PLANNER' })
const originalPropagationId = 'PROP-UPSTREAM-BLOCKED' as PropagationId
const releasePropagationId = 'PROP-UPSTREAM-RESUMED' as PropagationId

const workOrderContract: EntityReactionContract = {
  entityType: 'work_order',
  capabilities: new Map([
    [EntityCapabilityIds.DependencyReleased, {
      id: EntityCapabilityIds.DependencyReleased,
      classify: (request) => Effect.succeed(eligible({
        entityType: 'work_order',
        entityId: request.target.id,
        targetState: 'resumed',
      })),
      dispatch: () => Effect.void,
    }],
  ]),
}

const observation = new ReactorObservation({
  event: new ReactorEventEnvelope({
    entryId: 'ENTRY-WORKORDER-RESUMED-PLANNER' as never,
    tag: 'WorkOrderResumed',
    primaryKey: upstream.id,
    occurredAt: DateTime.unsafeNow(),
  }),
  subject: upstream,
  signals: [new ObservationSignal({
    axis: 'work_order.execution',
    kind: 'condition_retracted',
    value: 'blocked',
    reason: 'planner test',
  })],
  causality: new ReactorCausality({
    propagationId: releasePropagationId,
    causedByPropagationId: originalPropagationId,
  }),
  payload: {},
})

const GraphClientPlannerTest = Layer.succeed(
  GraphClient,
  GraphClient.of({
    expandPropagationTargets: () => Effect.succeed([{
      edgeType: 'depends_on',
      source: downstream,
      target: upstream,
      requestTarget: downstream,
    }]),
  } as any),
)

const PlannerTestLayer = ReactorPlannerLive.pipe(
  Layer.provide(GraphClientPlannerTest),
  Layer.provide(ReactorRegistryLayer({
    observations: [],
    propagationPolicies: [DependsOnWorkOrderBlockRetractedReleasesSource],
    entities: [workOrderContract],
  })),
)

describe('ReactorPlanner', () => {
  it('enriches release-capable requests with natural constraint addresses from policy hints', async () => {
    const plan = await Effect.runPromise(Effect.gen(function* () {
      const planner = yield* ReactorPlanner
      return yield* planner.planObservation(observation)
    }).pipe(Effect.provide(PlannerTestLayer)))

    expect(plan.decisions).toHaveLength(1)
    const payload = plan.decisions[0]!.request.payload
    expect(payload.effect).toBe('release_candidate')
    expect(payload.sourceEntryId).toBe('ENTRY-WORKORDER-RESUMED-PLANNER')
    expect(payload.sourceEvent).toBe('WorkOrderResumed')
    expect(payload.policyEpoch).toBeDefined()
    expect(payload.registryFingerprint).toMatch(/^fnv1a32:/)
    expect(payload.naturalAddress).toBeInstanceOf(ReactorConstraintNaturalAddress)
    expect(payload.naturalAddress).toMatchObject({
      target: downstream,
      capability: EntityCapabilityIds.DependencyBlocked,
      source: upstream,
      relationshipEdgeType: 'depends_on',
      policyId: 'depends_on.work-order-blocked.blocks-source',
      propagationId: originalPropagationId,
    })
  })
})
