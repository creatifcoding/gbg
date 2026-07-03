/**
 * Sharded local guard for MshBridge CAS attempts.
 *
 * Distributed correctness comes from JetStream publish expectations + KV CAS.
 * This guard is only a local contention reducer: streams hashing to the same
 * shard serialize within this process, while unrelated shards proceed in
 * parallel. Not a distributed lock. Not a tiny monarchy. A bouncer.
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Semaphore from "effect/Semaphore"

import type { StreamId } from "../../../contracts/StreamId.js"

export interface ShardGuardOptions {
  readonly shardCount?: number
}

export interface ShardGuardShape {
  readonly shardCount: number
  readonly shardOf: (streamId: StreamId) => number
  readonly withShard: (shard: number) => <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  readonly withStream: (streamId: StreamId) => <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
}

export const DEFAULT_SHARD_COUNT = 64

const fnv1a = (text: string): number => {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

const normalizeShard = (shard: number, shardCount: number): number =>
  ((Math.trunc(shard) % shardCount) + shardCount) % shardCount

const makeShardGuard = (options: ShardGuardOptions = {}) =>
  Effect.gen(function* () {
    const shardCount = options.shardCount ?? DEFAULT_SHARD_COUNT
    const semaphores: Semaphore.Semaphore[] = []
    for (let i = 0; i < shardCount; i += 1) {
      semaphores.push(yield* Semaphore.make(1))
    }

    const shardOf = (streamId: StreamId): number =>
      normalizeShard(fnv1a(streamId as string), shardCount)

    const withShard: ShardGuardShape["withShard"] = (shard) => (effect) => {
      const index = normalizeShard(shard, shardCount)
      return Semaphore.withPermit(semaphores[index]!, effect)
    }

    const withStream: ShardGuardShape["withStream"] = (streamId) =>
      withShard(shardOf(streamId))

    return ShardGuard.of({ shardCount, shardOf, withShard, withStream })
  })

export class ShardGuard extends Context.Service<
  ShardGuard,
  ShardGuardShape
>()("@tmnl/lnk/services/wire/nats-bridge/ShardGuard") {
  static readonly layer = (options: ShardGuardOptions = {}): Layer.Layer<ShardGuard> =>
    Layer.effect(ShardGuard, makeShardGuard(options))
}
