/**
 * Lnk basic tests against InMemoryWire.
 *
 * Phase 2.0 milestones covered:
 *   - Lnk.make scoped construction (driver fiber spawned + scope-bound)
 *   - asEffect() returns Option<Message> (yieldable in Effect.gen)
 *   - subscribe() emits messages as they arrive
 *   - append() / close() / head() delegate correctly
 *   - read() one-shot catch-up returns Stream<Message>
 *
 * @module @tmnl/lnk/test/services/lnks/Lnk
 */

import { describe, it, expect } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as Fiber from "effect-v4/Fiber"
import type * as Layer from "effect-v4/Layer"
import * as Option from "effect-v4/Option"
import * as Stream from "effect-v4/Stream"

import { trust as trustContentType } from "../../../src/contracts/ContentType.js"
import { trust as trustStreamId } from "../../../src/contracts/StreamId.js"
import { Wire } from "../../../src/services/wire/Wire.js"
import { InMemoryWire } from "../../../src/services/wire/in-memory/InMemoryWire.js"
import { Lnk } from "../../../src/services/lnks/Lnk.js"

const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder()

const layer: Layer.Layer<Wire> = InMemoryWire.layer

const provided = <A, E>(eff: Effect.Effect<A, E, Wire>): Promise<A> =>
  Effect.runPromise(
    eff.pipe(Effect.provide(layer)) as Effect.Effect<A, E, never>,
  )

let counter = 0
const makeStreamId = (prefix: string) =>
  trustStreamId(`lnk-${prefix}-${Date.now()}-${++counter}`)

describe("Lnk", () => {
  describe("construction + asEffect", () => {
    it("yields None before any messages", async () => {
      const sid = makeStreamId("init")
      const result = await provided(
        Effect.gen(function* () {
          const wire = yield* Wire
          yield* wire.put({
            streamId: sid,
            contentType: trustContentType("text/plain"),
          })
          return yield* Effect.scoped(
            Effect.gen(function* () {
              const lnk = yield* Lnk.make(sid, trustContentType("text/plain"), {
                fromOffset: "now",
                pollTimeoutMs: 100,
              })
              return yield* lnk
            }),
          )
        }),
      )
      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe("append + subscribe", () => {
    it("subscribe receives messages appended after subscription", async () => {
      const sid = makeStreamId("subscribe-after")
      const received = await provided(
        Effect.gen(function* () {
          const wire = yield* Wire
          yield* wire.put({
            streamId: sid,
            contentType: trustContentType("text/plain"),
          })
          return yield* Effect.scoped(
            Effect.gen(function* () {
              const lnk = yield* Lnk.make(sid, trustContentType("text/plain"), {
                fromOffset: "now",
                pollTimeoutMs: 50,
              })
              const collected = yield* Effect.forkChild(
                Stream.runCollect(Stream.take(lnk.subscribe(), 2)),
              )
              // Give the driver a moment to start its long-poll.
              yield* Effect.sleep("100 millis")
              yield* lnk.append(TEXT_ENCODER.encode("first"))
              yield* lnk.append(TEXT_ENCODER.encode("second"))
              const out = yield* Fiber.join(collected)
              return Array.from(out).map((m) =>
                TEXT_DECODER.decode(m.payload),
              )
            }),
          )
        }),
      )
      expect(received).toEqual(["first", "second"])
    })

    it("asEffect yields Some(latest) after first batch", async () => {
      const sid = makeStreamId("latest")
      const result = await provided(
        Effect.gen(function* () {
          const wire = yield* Wire
          yield* wire.put({
            streamId: sid,
            contentType: trustContentType("text/plain"),
          })
          return yield* Effect.scoped(
            Effect.gen(function* () {
              const lnk = yield* Lnk.make(sid, trustContentType("text/plain"), {
                fromOffset: "-1",
                pollTimeoutMs: 50,
              })
              yield* lnk.append(TEXT_ENCODER.encode("hello"))
              for (let i = 0; i < 20; i++) {
                const latest = yield* lnk
                if (Option.isSome(latest)) return latest
                yield* Effect.sleep("50 millis")
              }
              return yield* lnk
            }),
          )
        }),
      )
      expect(Option.isSome(result)).toBe(true)
      if (Option.isSome(result)) {
        expect(TEXT_DECODER.decode(result.value.payload)).toBe("hello")
      }
    })
  })

  describe("close + head", () => {
    it("close marks the stream as closed; head reflects it", async () => {
      const sid = makeStreamId("close")
      await provided(
        Effect.gen(function* () {
          const wire = yield* Wire
          yield* wire.put({
            streamId: sid,
            contentType: trustContentType("text/plain"),
          })
          yield* Effect.scoped(
            Effect.gen(function* () {
              const lnk = yield* Lnk.make(sid, trustContentType("text/plain"), {
                fromOffset: "now",
                pollTimeoutMs: 50,
              })
              yield* lnk.close()
              const meta = yield* lnk.head()
              expect(meta.closed).toBe(true)
            }),
          )
        }),
      )
    })
  })

  describe("read (one-shot catch-up)", () => {
    it("read returns historical messages in order", async () => {
      const sid = makeStreamId("read-history")
      const decoded = await provided(
        Effect.gen(function* () {
          const wire = yield* Wire
          yield* wire.put({
            streamId: sid,
            contentType: trustContentType("text/plain"),
          })
          yield* wire.post({
            streamId: sid,
            body: TEXT_ENCODER.encode("alpha"),
          })
          yield* wire.post({
            streamId: sid,
            body: TEXT_ENCODER.encode("beta"),
          })
          return yield* Effect.scoped(
            Effect.gen(function* () {
              const lnk = yield* Lnk.make(sid, trustContentType("text/plain"), {
                fromOffset: "now",
                pollTimeoutMs: 50,
              })
              const stream = yield* lnk.read({ fromOffset: "-1" })
              const collected = yield* Stream.runCollect(stream)
              return Array.from(collected).map((m) =>
                TEXT_DECODER.decode(m.payload),
              )
            }),
          )
        }),
      )
      expect(decoded).toEqual(["alpha", "beta"])
    })
  })
})
