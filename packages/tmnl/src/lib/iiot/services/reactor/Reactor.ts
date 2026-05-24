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
import { ReactorSourceClaimRepo } from '../../repos/ReactorSourceClaimRepo'
import type { ReactorCheckpointOutcome, ReactorClaimToken, ReactorOwnerKey, ReactorSourceEntryId } from '../../schemas/reactor'
import { ReactorPlan, ReactorRun } from '../../schemas/reactor'
import { ReactorDispatcher } from './ReactorDispatcher'
import { ReactorPlanner } from './ReactorPlanner'
import { ReactorRegistry } from './ReactorRegistry'
import {
  ReactorAdmissionControl,
  reactorAdmissionControlPassthrough,
} from './ReactorAdmissionControl'

const GENERIC_REACTOR_CONSUMER_ID = 'relationship-reactor-generic-v1' as never
const GENERIC_REACTOR_CLAIMED_BY = `relationship-reactor-generic:${crypto.randomUUID()}`

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
    const registry = yield* ReactorRegistry
    const checkpoints = yield* Effect.serviceOption(ReactorCheckpointRepo)
    const sourceClaims = yield* Effect.serviceOption(ReactorSourceClaimRepo)
    const admissionOption = yield* Effect.serviceOption(ReactorAdmissionControl)
    const admission = Option.getOrElse(admissionOption, () => reactorAdmissionControlPassthrough)

    const execute = (plan: ReactorPlan) => dispatcher.execute(plan)

    const planJournalEntry = (entry: EventJournal.Entry) => planner.planJournalEntry(entry)

    const repairCheckpointFromCompletedClaim = (claim: {
      readonly sourceEntryId: ReactorSourceEntryId
      readonly sourceEvent: string
      readonly primaryKey: string
      readonly outcome?: ReactorCheckpointOutcome
      readonly attempt: number
      readonly policyEpoch: unknown
      readonly registryFingerprint: unknown
    }) =>
      Option.isSome(checkpoints)
        ? admission.withSqlBudget(checkpoints.value.markProcessed({
          consumerId: GENERIC_REACTOR_CONSUMER_ID,
          sourceEntryId: claim.sourceEntryId,
          sourceEvent: claim.sourceEvent,
          primaryKey: claim.primaryKey,
          outcome: claim.outcome ?? 'processed',
          metadata: {
            repairedFromCompletedClaim: true,
            claimAttempt: claim.attempt,
            policyEpoch: String(claim.policyEpoch),
            registryFingerprint: String(claim.registryFingerprint),
          },
        })).pipe(Effect.asVoid)
        : Effect.void

    const reactToJournalEntry = (entry: EventJournal.Entry) =>
      Effect.gen(function* () {
        const sourceEntryId = entry.idString as ReactorSourceEntryId

        if (Option.isSome(checkpoints)) {
          const alreadyProcessed = yield* admission.withSqlBudget(checkpoints.value.hasProcessed({
            consumerId: GENERIC_REACTOR_CONSUMER_ID,
            sourceEntryId,
          }))
          if (alreadyProcessed) return Option.none<ReactorRun>()
        }

        const observation = yield* registry.observe(entry)
        if (Option.isNone(observation)) return Option.none<ReactorRun>()

        let activeClaimToken: ReactorClaimToken | undefined

        if (Option.isSome(sourceClaims)) {
          const ownerKey = `relationship-reactor:${observation.value.subject.type}:${observation.value.subject.id}` as ReactorOwnerKey
          const acquire = yield* admission.withSourceEntryClaim(
            {
              consumerId: GENERIC_REACTOR_CONSUMER_ID,
              sourceEntryId,
            },
            admission.withSqlBudget(sourceClaims.value.tryAcquire({
              consumerId: GENERIC_REACTOR_CONSUMER_ID,
              sourceEntryId,
              sourceEvent: entry.event,
              primaryKey: entry.primaryKey,
              ownerKey,
              policyEpoch: registry.policyEpoch,
              registryFingerprint: registry.registryFingerprint,
              claimedBy: GENERIC_REACTOR_CLAIMED_BY,
              metadata: {
                subjectType: observation.value.subject.type,
                subjectId: observation.value.subject.id,
              },
            })),
          )

          switch (acquire._tag) {
            case 'ReactorClaimAcquired':
            case 'ReactorClaimReacquired':
              activeClaimToken = acquire.claim.claimToken
              break
            case 'ReactorClaimCompleted':
              yield* repairCheckpointFromCompletedClaim(acquire.claim)
              return Option.none<ReactorRun>()
            case 'ReactorClaimBusy':
            case 'ReactorClaimDeferred':
            case 'ReactorClaimBlocked':
            case 'ReactorClaimEpochConflict':
            case 'ReactorClaimRegistryDrift':
              return Option.none<ReactorRun>()
          }
        }

        const plan = yield* planner.planObservation(observation.value)
        const run = yield* execute(plan)
        const outcome = checkpointOutcome(run)
        const metadata = {
          decisionCount: run.results.length,
          dispatchedCount: run.results.filter((result) => result.outcome === 'dispatched').length,
          failedCount: run.results.filter((result) => result.outcome === 'failed').length,
        }

        if (Option.isSome(sourceClaims) && activeClaimToken !== undefined) {
          const completedClaim = yield* admission.withSqlBudget(sourceClaims.value.complete({
            consumerId: GENERIC_REACTOR_CONSUMER_ID,
            sourceEntryId,
            claimToken: activeClaimToken,
            outcome,
            metadata,
          }))
          if (!completedClaim) return Option.some(run)
        }

        if (Option.isSome(checkpoints)) {
          yield* admission.withSqlBudget(checkpoints.value.markProcessed({
            consumerId: GENERIC_REACTOR_CONSUMER_ID,
            sourceEntryId,
            sourceEvent: entry.event,
            primaryKey: entry.primaryKey,
            outcome,
            metadata,
          }))
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
