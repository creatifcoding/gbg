/**
 * ReactorPlanner — dry-run planning for rule-driven propagation.
 *
 * The planner is the generic core loop up to, but not including, target command
 * dispatch. It consumes observations, matches relationship propagation policies,
 * expands graph targets, asks target contracts for eligibility, and returns an
 * explainable plan.
 *
 * @module
 */

import { Context, Effect, Layer, Option } from 'effect'
import * as EventJournal from '@effect/experimental/EventJournal'
import { GraphClient } from '../l1/GraphClient'
import {
  EntityReactionRequest,
  ObservationSignal,
  ReactorConstraintEffects,
  ReactorConstraintNaturalAddress,
  ReactorDecision,
  ReactorObservation,
  ReactorPlan,
  ReactorRequestId,
} from '../../schemas/reactor'
import type { PropagationId } from '../../schemas/identifiers'
import type {
  ConstraintAddressPropagationIdSource,
  RelationshipEndpoint,
  RelationshipPropagationPolicy,
} from '../../schemas/relationships/edge-types'
import type { PropagationTargetExpansion } from '../l1/GraphClient'
import { ReactorRegistry } from './ReactorRegistry'

export interface ReactorPlannerShape {
  readonly planObservation: (observation: ReactorObservation) => Effect.Effect<ReactorPlan, unknown>
  readonly planJournalEntry: (entry: EventJournal.Entry) => Effect.Effect<Option.Option<ReactorPlan>, unknown>
}

export class ReactorPlanner extends Context.Tag('iiot/ReactorPlanner')<
  ReactorPlanner,
  ReactorPlannerShape
>() {}

const requestIdFor = (input: {
  readonly observation: ReactorObservation
  readonly signal: ObservationSignal
  readonly target: RelationshipEndpoint
  readonly policyId: string
}): ReactorRequestId =>
  [
    input.observation.event.entryId,
    input.policyId,
    input.signal.axis,
    input.signal.value,
    input.target.type,
    input.target.id,
  ].join(':') as ReactorRequestId

const decisionOutcomeFromEligibility = (outcome: string): 'eligible' | 'skipped' | 'deferred' | 'failed' => {
  switch (outcome) {
    case 'eligible':
      return 'eligible'
    case 'failed':
      return 'failed'
    default:
      return 'skipped'
  }
}

const stringFromPayload = (payload: unknown, key: string): string | undefined => {
  if (typeof payload !== 'object' || payload === null) return undefined
  const value = (payload as Record<string, unknown>)[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

const propagationIdForAddressHint = (
  observation: ReactorObservation,
  source: ConstraintAddressPropagationIdSource,
): PropagationId | undefined => {
  switch (source) {
    case 'current':
      return observation.causality.propagationId
    case 'caused_by':
      return observation.causality.causedByPropagationId
    case 'payload': {
      const fromPayload = stringFromPayload(observation.payload, 'propagationId')
        ?? stringFromPayload(observation.payload, 'causedByPropagationId')
      return fromPayload as PropagationId | undefined
    }
  }
}

const payloadForPolicy = (input: {
  readonly policy: RelationshipPropagationPolicy
  readonly observation: ReactorObservation
  readonly expansion: PropagationTargetExpansion
}): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    ...input.policy.request.payloadDefaults,
    reason: input.policy.request.reason,
    relationshipEdgeType: input.policy.edgeType,
  }

  const hint = input.policy.constraintAddressHint
  if (hint === undefined) return payload

  const propagationId = propagationIdForAddressHint(input.observation, hint.propagationIdSource)
  if (propagationId === undefined) {
    return {
      ...payload,
      constraintAddressMissing: {
        assertedCapability: hint.assertedCapability,
        assertionPolicyId: hint.assertionPolicyId,
        propagationIdSource: hint.propagationIdSource,
      },
    }
  }

  return {
    ...payload,
    naturalAddress: new ReactorConstraintNaturalAddress({
      target: input.expansion.requestTarget,
      capability: hint.assertedCapability,
      source: input.observation.subject,
      relationshipEdgeType: input.policy.edgeType,
      policyId: hint.assertionPolicyId,
      propagationId,
    }),
    effect: ReactorConstraintEffects.ReleaseCandidate,
    constraintAddressHint: hint,
  }
}

export const ReactorPlannerLive = Layer.effect(
  ReactorPlanner,
  Effect.gen(function* () {
    const registry = yield* ReactorRegistry
    const graph = yield* GraphClient

    const planObservation = (observation: ReactorObservation) =>
      Effect.gen(function* () {
        const decisionsBySignal = yield* Effect.forEach(
          observation.signals,
          (signal) =>
            Effect.gen(function* () {
              const policies = registry.policiesForSignal(signal)

              const decisionsByPolicy = yield* Effect.forEach(
                policies,
                (policy) =>
                  Effect.gen(function* () {
                    const expansions = yield* graph.expandPropagationTargets({
                      observation,
                      policy,
                      signal,
                    })

                    return yield* Effect.forEach(
                      expansions,
                      (expansion) => {
                        const request = new EntityReactionRequest({
                          requestId: requestIdFor({
                            observation,
                            signal,
                            target: expansion.requestTarget,
                            policyId: policy.id,
                          }),
                          capability: policy.request.capability,
                          source: observation.subject,
                          target: expansion.requestTarget,
                          signal,
                          policyId: policy.id,
                          policyVersion: policy.version,
                          causality: observation.causality,
                          payload: payloadForPolicy({ policy, observation, expansion }),
                        })

                        const capability = registry.capabilityFor({
                          entityType: expansion.requestTarget.type,
                          capability: policy.request.capability,
                        })

                        if (Option.isNone(capability)) {
                          return Effect.succeed(new ReactorDecision({
                            target: expansion.requestTarget,
                            request,
                            outcome: 'failed',
                            reason: `missing_capability:${expansion.requestTarget.type}.${policy.request.capability}`,
                          }))
                        }

                        return capability.value.classify(request).pipe(
                          Effect.map((eligibility) => new ReactorDecision({
                            target: expansion.requestTarget,
                            request,
                            outcome: decisionOutcomeFromEligibility(eligibility.outcome),
                            reason: eligibility.reason,
                          })),
                          Effect.catchAll((error) => Effect.succeed(new ReactorDecision({
                            target: expansion.requestTarget,
                            request,
                            outcome: 'failed',
                            reason: String(error),
                          }))),
                        )
                      },
                      { concurrency: 8 },
                    )
                  }),
                { concurrency: 'unbounded' },
              )

              return decisionsByPolicy.flat()
            }),
          { concurrency: 'unbounded' },
        )

        return new ReactorPlan({
          observation,
          decisions: decisionsBySignal.flat(),
        })
      }).pipe(Effect.withSpan('iiot.reactor.planObservation'))

    const planJournalEntry = (entry: EventJournal.Entry) =>
      Effect.gen(function* () {
        const observation = yield* registry.observe(entry)
        if (Option.isNone(observation)) return Option.none<ReactorPlan>()
        const plan = yield* planObservation(observation.value)
        return Option.some(plan)
      }).pipe(Effect.withSpan('iiot.reactor.planJournalEntry'))

    return ReactorPlanner.of({
      planObservation,
      planJournalEntry,
    })
  }),
)
