/**
 * Lnk × @tmnl/stx integration tests.
 *
 * Phase 2.3 milestones covered:
 *   - lnkLatest: atoms update as messages arrive
 *   - lnkFeed: items array accumulates across appends
 *   - Atom values are visible to non-React consumers via registry.get
 *
 * @module @tmnl/lnk/test/services/lnks/Stx
 */

import { describe, it, expect } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as AtomRegistry from "effect-v4/unstable/reactivity/AtomRegistry"

import { trust as trustContentType } from "../../../src/contracts/ContentType.js"
import { trust as trustStreamId } from "../../../src/contracts/StreamId.js"
import { Wire } from "../../../src/services/wire/Wire.js"
import { InMemoryWire } from "../../../src/services/wire/in-memory/InMemoryWire.js"
import { Lnk } from "../../../src/services/lnks/Lnk.js"
import { lnkFeed, lnkLatest } from "../../../src/services/lnks/Stx.js"

const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder()

const wireLayer = InMemoryWire.layer

const provided = <A, E>(eff: Effect.Effect<A, E, Wire>): Promise<A> =>
  Effect.runPromise(
    eff.pipe(Effect.provide(wireLayer)) as Effect.Effect<A, E, never>,
  )

let counter = 0
const makeStreamId = (prefix: string) =>
  trustStreamId(`stx-${prefix}-${Date.now()}-${++counter}`)



/**
 * Effect-bridged poll: keep the Lnk's scope alive while waiting for the
 * driver fiber to deliver into the PubSub and the stx materializer fiber
 * to update the atom. Closing the scope prematurely shuts down the
 * PubSub before the chain completes — atoms are then stale (None / []).
 */
const pollEffect = <T>(
  fn: () => T,
  pred: (v: T) => boolean,
  attempts = 30,
  delayMs = 50,
) =>
  Effect.gen(function* () {
    for (let i = 0; i < attempts; i++) {
      const v = fn()
      if (pred(v)) return v
      yield* Effect.sleep(`${delayMs} millis`)
    }
    return fn()
  })

describe("Lnk × Stx", () => {
  describe("lnkLatest", () => {
    it("value atom updates when a message is appended", async () => {
      const sid = makeStreamId("latest")
      const registry = AtomRegistry.make()
      const value = await provided(
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
              const instance = lnkLatest(lnk, registry)
              yield* Effect.sleep("100 millis")
              yield* lnk.append(TEXT_ENCODER.encode("hello"))
              return yield* pollEffect(
                () => registry.get(instance.value),
                (v) => v !== undefined,
              )
            }),
          )
        }),
      )
      expect(value).toBeDefined()
      if (value !== undefined) {
        expect(TEXT_DECODER.decode(value.payload)).toBe("hello")
      }
    })
  })

  describe("lnkFeed", () => {
    it("items atom accumulates messages", async () => {
      const sid = makeStreamId("feed")
      const registry = AtomRegistry.make()
      const items = await provided(
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
              const instance = lnkFeed(lnk, registry)
              yield* Effect.sleep("100 millis")
              yield* lnk.append(TEXT_ENCODER.encode("a"))
              yield* lnk.append(TEXT_ENCODER.encode("b"))
              yield* lnk.append(TEXT_ENCODER.encode("c"))
              return yield* pollEffect(
                () => registry.get(instance.items),
                (v) => v.length >= 3,
              )
            }),
          )
        }),
      )
      expect(items.length).toBeGreaterThanOrEqual(3)
      const decoded = items.slice(0, 3).map((m) => TEXT_DECODER.decode(m.payload))
      expect(decoded).toEqual(["a", "b", "c"])
    })
  })
})
