/**
 * ReactorAdmissionControl — app-local pressure control for Reactor stages.
 *
 * This service is deliberately not a source of durable truth. It shapes local
 * execution before expensive/contended boundaries; SQL and target entities
 * remain authoritative for ownership, idempotency, constraints, and transitions.
 *
 * @module
 */

import { Context, Deferred, Effect, Layer } from 'effect'
import type { ReactorConsumerId, ReactorSourceEntryId } from '../../schemas/reactor'
import type { RelationshipEndpoint } from '../../schemas/relationships'

export interface ReactorAdmissionControlConfig {
  readonly sqlPermits: number
}

export const ReactorAdmissionControlConfigDefaults: ReactorAdmissionControlConfig = {
  sqlPermits: 8,
}

export interface ReactorSourceEntryClaimKey {
  readonly consumerId: ReactorConsumerId | string
  readonly sourceEntryId: ReactorSourceEntryId | string
}

export interface ReactorAdmissionControlShape {
  /** Serialize local work for one target key. */
  readonly withTargetGate: <A, E, R>(
    target: RelationshipEndpoint,
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>

  /** Serialize local source claim attempts without sharing ownership results. */
  readonly withSourceEntryClaim: <A, E, R>(
    key: ReactorSourceEntryClaimKey,
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>

  /** Share one in-flight constraint operation for equivalent local work. */
  readonly withConstraintSingleflight: <A, E, R>(
    key: string,
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>

  /** Generic duplicate-suppression primitive. */
  readonly singleflight: <A, E, R>(
    key: string,
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>

  /** Bound local SQL pressure before distributed authority does its work. */
  readonly withSqlBudget: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>

  /** Collapse equivalent local artifacts while keeping the first representative. */
  readonly coalesceByKey: <A>(
    items: Iterable<A>,
    keyOf: (item: A) => string,
  ) => readonly A[]
}

export class ReactorAdmissionControl extends Context.Tag('iiot/ReactorAdmissionControl')<
  ReactorAdmissionControl,
  ReactorAdmissionControlShape
>() {}

type GateEntry = {
  readonly semaphore: Effect.Semaphore
  refs: number
}

const targetKey = (target: RelationshipEndpoint): string => `${target.type}:${target.id}`

const sourceEntryKey = (key: ReactorSourceEntryClaimKey): string =>
  `source:${key.consumerId}:${key.sourceEntryId}`

export const reactorAdmissionControlPassthrough: ReactorAdmissionControlShape = {
  withTargetGate: (_target, effect) => effect,
  withSourceEntryClaim: (_key, effect) => effect,
  withConstraintSingleflight: (_key, effect) => effect,
  singleflight: (_key, effect) => effect,
  withSqlBudget: (effect) => effect,
  coalesceByKey: <A,>(items: Iterable<A>, keyOf: (item: A) => string): readonly A[] => {
    const seen = new Set<string>()
    const coalesced: A[] = []
    for (const item of items) {
      const key = keyOf(item)
      if (seen.has(key)) continue
      seen.add(key)
      coalesced.push(item)
    }
    return coalesced
  },
}

export const makeReactorAdmissionControlLive = (
  config: Partial<ReactorAdmissionControlConfig> = {},
) => Layer.effect(
  ReactorAdmissionControl,
  Effect.gen(function* () {
    const resolved = {
      ...ReactorAdmissionControlConfigDefaults,
      ...config,
    }
    const sqlBudget = yield* Effect.makeSemaphore(resolved.sqlPermits)
    const gateMutex = yield* Effect.makeSemaphore(1)
    const singleflightMutex = yield* Effect.makeSemaphore(1)
    const targetGates = new Map<string, GateEntry>()
    const inFlight = new Map<string, Deferred.Deferred<unknown, unknown>>()

    const acquireTargetGate = (key: string) => gateMutex.withPermits(1)(
      Effect.gen(function* () {
        const existing = targetGates.get(key)
        if (existing !== undefined) {
          existing.refs += 1
          return existing.semaphore
        }

        const semaphore = yield* Effect.makeSemaphore(1)
        targetGates.set(key, { semaphore, refs: 1 })
        return semaphore
      }),
    )

    const releaseTargetGate = (key: string, semaphore: Effect.Semaphore) => gateMutex.withPermits(1)(
      Effect.sync(() => {
        const existing = targetGates.get(key)
        if (existing === undefined || existing.semaphore !== semaphore) return

        existing.refs -= 1
        if (existing.refs <= 0) targetGates.delete(key)
      }),
    )

    const acquireSingleflight = <A, E>(key: string) => singleflightMutex.withPermits(1)(
      Effect.gen(function* () {
        const existing = inFlight.get(key)
        if (existing !== undefined) {
          return {
            leader: false as const,
            deferred: existing as Deferred.Deferred<A, E>,
          }
        }

        const deferred = yield* Deferred.make<A, E>()
        inFlight.set(key, deferred as Deferred.Deferred<unknown, unknown>)
        return { leader: true as const, deferred }
      }),
    )

    const forgetSingleflight = <A, E>(key: string, deferred: Deferred.Deferred<A, E>) => singleflightMutex.withPermits(1)(
      Effect.sync(() => {
        if (inFlight.get(key) === deferred) inFlight.delete(key)
      }),
    )

    const singleflight: ReactorAdmissionControlShape['singleflight'] = (key, effect) =>
      Effect.gen(function* () {
        const slot = yield* acquireSingleflight(key)
        if (!slot.leader) return yield* Deferred.await(slot.deferred)

        return yield* effect.pipe(
          Effect.onExit((exit) =>
            Deferred.done(slot.deferred, exit).pipe(
              Effect.zipRight(forgetSingleflight(key, slot.deferred)),
            ),
          ),
        )
      }).pipe(Effect.withSpan('iiot.reactor.admission.singleflight'))

    const withKeyedGate = <A, E, R>(key: string, effect: Effect.Effect<A, E, R>) =>
      Effect.gen(function* () {
        const semaphore = yield* acquireTargetGate(key)
        return yield* semaphore.withPermits(1)(effect).pipe(
          Effect.ensuring(releaseTargetGate(key, semaphore)),
        )
      })

    const withTargetGate: ReactorAdmissionControlShape['withTargetGate'] = (target, effect) =>
      withKeyedGate(`target:${targetKey(target)}`, effect).pipe(
        Effect.withSpan('iiot.reactor.admission.withTargetGate'),
      )

    const withSourceEntryClaim: ReactorAdmissionControlShape['withSourceEntryClaim'] = (key, effect) =>
      withKeyedGate(sourceEntryKey(key), effect).pipe(
        Effect.withSpan('iiot.reactor.admission.withSourceEntryClaim'),
      )

    const withConstraintSingleflight: ReactorAdmissionControlShape['withConstraintSingleflight'] = (key, effect) =>
      singleflight(`constraint:${key}`, effect).pipe(
        Effect.withSpan('iiot.reactor.admission.withConstraintSingleflight'),
      )

    const withSqlBudget: ReactorAdmissionControlShape['withSqlBudget'] = (effect) =>
      sqlBudget.withPermits(1)(effect).pipe(
        Effect.withSpan('iiot.reactor.admission.withSqlBudget'),
      )

    const coalesceByKey = <A,>(items: Iterable<A>, keyOf: (item: A) => string): readonly A[] => {
      const seen = new Set<string>()
      const coalesced: A[] = []
      for (const item of items) {
        const key = keyOf(item)
        if (seen.has(key)) continue
        seen.add(key)
        coalesced.push(item)
      }
      return coalesced
    }

    return ReactorAdmissionControl.of({
      withTargetGate,
      withSourceEntryClaim,
      withConstraintSingleflight,
      singleflight,
      withSqlBudget,
      coalesceByKey,
    })
  }),
)

export const ReactorAdmissionControlLive = makeReactorAdmissionControlLive()

export const ReactorAdmissionControlPassthroughLive = Layer.succeed(
  ReactorAdmissionControl,
  ReactorAdmissionControl.of(reactorAdmissionControlPassthrough),
)
