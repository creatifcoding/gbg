/** ReactorAdmissionControl unit tests. */

import { Deferred, Effect, Fiber, Ref } from 'effect'
import { describe, expect, it } from 'vitest'
import { RelationshipEndpoint } from '../../../schemas/relationships'
import {
  makeReactorAdmissionControlLive,
  ReactorAdmissionControl,
} from '../ReactorAdmissionControl'

const target = new RelationshipEndpoint({ type: 'work_order', id: 'WO-ADMISSION-001' })

const TestAdmissionLayer = makeReactorAdmissionControlLive({ sqlPermits: 2 })

const run = <A, E>(program: Effect.Effect<A, E, ReactorAdmissionControl>) =>
  Effect.runPromise(program.pipe(Effect.provide(TestAdmissionLayer)))

describe('ReactorAdmissionControl', () => {
  it('shares one in-flight execution for duplicate singleflight keys', async () => {
    const result = await run(Effect.gen(function* () {
      const admission = yield* ReactorAdmissionControl
      const calls = yield* Ref.make(0)
      const started = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()

      const work = admission.singleflight('duplicate-key', Effect.gen(function* () {
        yield* Ref.update(calls, (count) => count + 1)
        yield* Deferred.succeed(started, undefined)
        yield* Deferred.await(release)
        return 'shared-result'
      }))

      const fibers = yield* Effect.forEach(
        Array.from({ length: 8 }),
        () => Effect.fork(work),
        { concurrency: 'unbounded' },
      )
      yield* Deferred.await(started)
      yield* Effect.sleep('10 millis')
      yield* Deferred.succeed(release, undefined)

      const values = yield* Effect.forEach(fibers, Fiber.join)
      const callCount = yield* Ref.get(calls)
      return { values, callCount }
    }))

    expect(result.values).toEqual(Array.from({ length: 8 }, () => 'shared-result'))
    expect(result.callCount).toBe(1)
  })

  it('cleans singleflight slots after failure so later attempts can retry', async () => {
    const result = await run(Effect.gen(function* () {
      const admission = yield* ReactorAdmissionControl
      const calls = yield* Ref.make(0)

      const unstable = Effect.gen(function* () {
        const call = yield* Ref.updateAndGet(calls, (count) => count + 1)
        if (call === 1) return yield* Effect.fail('boom')
        return `ok-${call}`
      })

      const first = yield* admission.singleflight('retry-key', unstable).pipe(Effect.either)
      const second = yield* admission.singleflight('retry-key', unstable).pipe(Effect.either)
      const callCount = yield* Ref.get(calls)
      return { first, second, callCount }
    }))

    expect(result.first._tag).toBe('Left')
    expect(result.second._tag).toBe('Right')
    if (result.second._tag === 'Right') expect(result.second.right).toBe('ok-2')
    expect(result.callCount).toBe(2)
  })

  it('serializes source claim attempts without sharing ownership results', async () => {
    const result = await run(Effect.gen(function* () {
      const admission = yield* ReactorAdmissionControl
      const calls = yield* Ref.make(0)

      const attempt = admission.withSourceEntryClaim(
        { consumerId: 'consumer', sourceEntryId: 'entry-1' },
        Effect.gen(function* () {
          const call = yield* Ref.updateAndGet(calls, (count) => count + 1)
          yield* Effect.sleep('5 millis')
          return call
        }),
      )

      const values = yield* Effect.all(
        Array.from({ length: 4 }, () => attempt),
        { concurrency: 'unbounded' },
      )
      const callCount = yield* Ref.get(calls)
      return { values, callCount }
    }))

    expect(result.callCount).toBe(4)
    expect([...result.values].sort()).toEqual([1, 2, 3, 4])
  })

  it('serializes concurrent work for the same target key', async () => {
    const result = await run(Effect.gen(function* () {
      const admission = yield* ReactorAdmissionControl
      const active = yield* Ref.make(0)
      const maxActive = yield* Ref.make(0)

      const gated = admission.withTargetGate(target, Effect.gen(function* () {
        const current = yield* Ref.updateAndGet(active, (count) => count + 1)
        yield* Ref.update(maxActive, (max) => Math.max(max, current))
        yield* Effect.sleep('5 millis')
        yield* Ref.update(active, (count) => count - 1)
      }))

      yield* Effect.all(
        Array.from({ length: 6 }, () => gated),
        { concurrency: 'unbounded' },
      )
      return yield* Ref.get(maxActive)
    }))

    expect(result).toBe(1)
  })

  it('bounds local SQL pressure with the configured budget', async () => {
    const result = await run(Effect.gen(function* () {
      const admission = yield* ReactorAdmissionControl
      const active = yield* Ref.make(0)
      const maxActive = yield* Ref.make(0)

      const sqlWork = admission.withSqlBudget(Effect.gen(function* () {
        const current = yield* Ref.updateAndGet(active, (count) => count + 1)
        yield* Ref.update(maxActive, (max) => Math.max(max, current))
        yield* Effect.sleep('5 millis')
        yield* Ref.update(active, (count) => count - 1)
      }))

      yield* Effect.all(
        Array.from({ length: 8 }, () => sqlWork),
        { concurrency: 'unbounded' },
      )
      return yield* Ref.get(maxActive)
    }))

    expect(result).toBeLessThanOrEqual(2)
    expect(result).toBeGreaterThan(1)
  })

  it('coalesces duplicate artifacts by stable key while preserving first representatives', async () => {
    const result = await run(Effect.gen(function* () {
      const admission = yield* ReactorAdmissionControl
      return admission.coalesceByKey(
        [
          { key: 'a', value: 1 },
          { key: 'b', value: 2 },
          { key: 'a', value: 3 },
          { key: 'c', value: 4 },
        ],
        (item) => item.key,
      )
    }))

    expect(result).toEqual([
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
      { key: 'c', value: 4 },
    ])
  })
})
