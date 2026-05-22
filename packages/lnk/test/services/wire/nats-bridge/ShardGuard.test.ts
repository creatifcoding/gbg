/** Tests for the local sharded CAS guard. */

import { describe, expect, it } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Ref from "effect-v4/Ref"

import { trust as trustStreamId } from "../../../../src/contracts/StreamId.js"
import { ShardGuard } from "../../../../src/services/wire/nats-bridge/ShardGuard.js"

describe("ShardGuard", () => {
  it("hashes streams deterministically into bounded shards", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const guard = yield* ShardGuard
        const stream = trustStreamId("tenant/a")
        return {
          shardCount: guard.shardCount,
          first: guard.shardOf(stream),
          second: guard.shardOf(stream),
        }
      }).pipe(Effect.provide(ShardGuard.layer({ shardCount: 8 }))),
    )

    expect(result.shardCount).toBe(8)
    expect(result.first).toBe(result.second)
    expect(result.first).toBeGreaterThanOrEqual(0)
    expect(result.first).toBeLessThan(8)
  })

  it("serializes effects on the same shard", async () => {
    const events = await Effect.runPromise(
      Effect.gen(function* () {
        const guard = yield* ShardGuard
        const ref = yield* Ref.make<string[]>([])
        const run = (name: string) =>
          guard.withShard(0)(
            Effect.gen(function* () {
              yield* Ref.update(ref, (items) => [...items, `${name}:start`])
              yield* Effect.sleep("20 millis")
              yield* Ref.update(ref, (items) => [...items, `${name}:end`])
            }),
          )

        yield* Effect.all([run("a"), run("b")], { concurrency: "unbounded" })
        return yield* Ref.get(ref)
      }).pipe(Effect.provide(ShardGuard.layer({ shardCount: 2 }))),
    )

    expect(events).toEqual(["a:start", "a:end", "b:start", "b:end"])
  })
})
