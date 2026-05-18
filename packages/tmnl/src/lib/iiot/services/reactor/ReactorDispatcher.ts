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

export interface ReactorDispatcherShape {
  readonly execute: (plan: ReactorPlan) => Effect.Effect<ReactorRun, unknown>
}

export class ReactorDispatcher extends Context.Tag('iiot/ReactorDispatcher')<
  ReactorDispatcher,
  ReactorDispatcherShape
>() {}

export const ReactorDispatcherLive = Layer.effect(
  ReactorDispatcher,
  Effect.gen(function* () {
    const registry = yield* ReactorRegistry

    const execute = (plan: ReactorPlan) =>
      Effect.gen(function* () {
        const results = yield* Effect.forEach(
          plan.decisions,
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
