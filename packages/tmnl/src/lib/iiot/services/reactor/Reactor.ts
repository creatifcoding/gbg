/**
 * Reactor — generic event-native relationship consistency engine.
 *
 * Public façade over planner + dispatcher + checkpointing. The Reactor consumes
 * durable domain events, plans propagation through relationship policies, sends
 * target-owned reaction requests, and records source-entry outcomes.
 *
 * @module
 */

import { Context, Effect, Layer, Option } from 'effect'
import * as EventJournal from '@effect/experimental/EventJournal'
import { ReactorCheckpointRepo } from '../../repos/ReactorCheckpointRepo'
import type { ReactorCheckpointOutcome } from '../../schemas/reactor'
import { ReactorPlan, ReactorRun } from '../../schemas/reactor'
import { ReactorDispatcher } from './ReactorDispatcher'
import { ReactorPlanner } from './ReactorPlanner'

const GENERIC_REACTOR_CONSUMER_ID = 'relationship-reactor-generic-v1' as never

export interface ReactorShape {
  readonly planJournalEntry: (entry: EventJournal.Entry) => Effect.Effect<Option.Option<ReactorPlan>, unknown>
  readonly execute: (plan: ReactorPlan) => Effect.Effect<ReactorRun, unknown>
  readonly reactToJournalEntry: (entry: EventJournal.Entry) => Effect.Effect<Option.Option<ReactorRun>, unknown>
}

export class Reactor extends Context.Tag('iiot/Reactor')<Reactor, ReactorShape>() {}

const checkpointOutcome = (run: ReactorRun): ReactorCheckpointOutcome =>
  run.results.some((result) => result.outcome === 'failed') ? 'failed'
    : run.results.some((result) => result.outcome === 'dispatched') ? 'processed'
    : 'skipped'

export const ReactorLive = Layer.effect(
  Reactor,
  Effect.gen(function* () {
    const planner = yield* ReactorPlanner
    const dispatcher = yield* ReactorDispatcher
    const checkpoints = yield* Effect.serviceOption(ReactorCheckpointRepo)

    const execute = (plan: ReactorPlan) => dispatcher.execute(plan)

    const planJournalEntry = (entry: EventJournal.Entry) => planner.planJournalEntry(entry)

    const reactToJournalEntry = (entry: EventJournal.Entry) =>
      Effect.gen(function* () {
        if (Option.isSome(checkpoints)) {
          const alreadyProcessed = yield* checkpoints.value.hasProcessed({
            consumerId: GENERIC_REACTOR_CONSUMER_ID,
            sourceEntryId: entry.idString as never,
          })
          if (alreadyProcessed) return Option.none<ReactorRun>()
        }

        const plan = yield* planJournalEntry(entry)
        if (Option.isNone(plan)) return Option.none<ReactorRun>()

        const run = yield* execute(plan.value)

        if (Option.isSome(checkpoints)) {
          yield* checkpoints.value.markProcessed({
            consumerId: GENERIC_REACTOR_CONSUMER_ID,
            sourceEntryId: entry.idString as never,
            sourceEvent: entry.event,
            primaryKey: entry.primaryKey,
            outcome: checkpointOutcome(run),
            metadata: {
              decisionCount: run.results.length,
              dispatchedCount: run.results.filter((result) => result.outcome === 'dispatched').length,
              failedCount: run.results.filter((result) => result.outcome === 'failed').length,
            },
          })
        }

        return Option.some(run)
      }).pipe(Effect.withSpan('iiot.reactor.reactToJournalEntry'))

    return Reactor.of({
      planJournalEntry,
      execute,
      reactToJournalEntry,
    })
  }),
)
