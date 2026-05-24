/**
 * ReactorDispatcher — executes target-owned reaction requests from a plan.
 *
 * The dispatcher does not interpret domain state. It only sends eligible
 * requests to registered entity reaction capabilities and records dispatch
 * outcomes in the generic ReactorRun envelope.
 *
 * @module
 */

import { Context, Effect, Layer, Option } from 'effect'
import {
  ReactorDecision,
  ReactorPlan,
  ReactorRun,
} from '../../schemas/reactor'
import { ReactorRegistry } from './ReactorRegistry'
import {
  ReactorAdmissionControl,
  reactorAdmissionControlPassthrough,
} from './ReactorAdmissionControl'

export interface ReactorDispatcherShape {
  readonly execute: (plan: ReactorPlan) => Effect.Effect<ReactorRun, unknown>
}

export class ReactorDispatcher extends Context.Tag('iiot/ReactorDispatcher')<
  ReactorDispatcher,
  ReactorDispatcherShape
>() {}

const decisionCoalesceKey = (decision: ReactorDecision): string => {
  const relationshipEdgeType = typeof decision.request.payload.relationshipEdgeType === 'string'
    ? decision.request.payload.relationshipEdgeType
    : 'unknown'

  return JSON.stringify({
    target: `${decision.target.type}:${decision.target.id}`,
    capability: decision.request.capability,
    source: `${decision.request.source.type}:${decision.request.source.id}`,
    relationshipEdgeType,
    policyId: decision.request.policyId,
    propagationId: decision.request.causality.propagationId,
    signal: {
      axis: decision.request.signal.axis,
      kind: decision.request.signal.kind,
      value: decision.request.signal.value,
    },
  })
}

export const ReactorDispatcherLive = Layer.effect(
  ReactorDispatcher,
  Effect.gen(function* () {
    const registry = yield* ReactorRegistry
    const admissionOption = yield* Effect.serviceOption(ReactorAdmissionControl)
    const admission = Option.getOrElse(admissionOption, () => reactorAdmissionControlPassthrough)

    const coalesceDecisions = (decisions: readonly ReactorDecision[]): readonly ReactorDecision[] => {
      const eligible = decisions.filter((decision) => decision.outcome === 'eligible')
      const coalescedEligible = new Set(admission.coalesceByKey(eligible, decisionCoalesceKey))
      return decisions.filter((decision) => decision.outcome !== 'eligible' || coalescedEligible.has(decision))
    }

    const execute = (plan: ReactorPlan) =>
      Effect.gen(function* () {
        const dispatchDecisions = coalesceDecisions(plan.decisions)
        const results = yield* Effect.forEach(
          dispatchDecisions,
          (decision) => {
            if (decision.outcome !== 'eligible') {
              return Effect.succeed(decision)
            }

            const capability = registry.capabilityFor({
              entityType: decision.target.type,
              capability: decision.request.capability,
            })

            if (Option.isNone(capability)) {
              return Effect.succeed(new ReactorDecision({
                ...decision,
                outcome: 'failed',
                reason: `missing_capability:${decision.target.type}.${decision.request.capability}`,
              }))
            }

            return capability.value.dispatch(decision.request).pipe(
              Effect.as(new ReactorDecision({
                ...decision,
                outcome: 'dispatched',
              })),
              Effect.catchAll((error) => Effect.succeed(new ReactorDecision({
                ...decision,
                outcome: 'failed',
                reason: String(error),
              }))),
            )
          },
          { concurrency: 8 },
        )

        return new ReactorRun({ plan, results })
      }).pipe(Effect.withSpan('iiot.reactor.dispatcher.execute'))

    return ReactorDispatcher.of({ execute })
  }),
)
