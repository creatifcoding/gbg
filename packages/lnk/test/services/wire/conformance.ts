/**
 * Internal conformance suite for `Wire` implementations.
 *
 * Parameterized over a `Layer<Wire>` so the same suite runs
 * against any wire impl (`InMemoryWire`, future `HttpWire`, etc.).
 *
 * Categories mirror the upstream
 * `@durable-streams/server-conformance-tests` structure (see CONFORMANCE.md
 * §14) but target our `Wire` Effect-native interface directly,
 * not raw HTTP. This is **Option B** from CONFORMANCE.md §14.1 — faster to
 * set up, validates spec semantics, complements the upstream HTTP-driven
 * suite (Option A) we'll add in Phase 1.1.
 *
 * @module @tmnl/lnk/test/services/wire/conformance
 */

import { describe, it, expect } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Stream from "effect-v4/Stream"

import { Wire } from "../../../src/services/wire/index.js"
import { trust as trustStreamId } from "../../../src/contracts/StreamId.js"
import { trust as trustContentType } from "../../../src/contracts/ContentType.js"
import {
  trustProducerId,
  trustEpoch,
  trustSeq,
} from "../../../src/contracts/Producer.js"

// ─── Helpers ────────────────────────────────────────────────────────────────

const TEXT_DECODER = new TextDecoder()
const TEXT_ENCODER = new TextEncoder()

const makeStreamId = (suffix: string) =>
  trustStreamId(`conformance-${suffix}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`)

const collectBody = (body: Stream.Stream<Uint8Array, never, never>): Effect.Effect<string, never, never> =>
  Effect.gen(function* () {
    const chunks = yield* Stream.runCollect(body)
    let total = 0
    const arr: Uint8Array[] = []
    for (const c of chunks) {
      arr.push(c)
      total += c.length
    }
    const out = new Uint8Array(total)
    let off = 0
    for (const c of arr) {
      out.set(c, off)
      off += c.length
    }
    return TEXT_DECODER.decode(out)
  })

// ─── Conformance runner ─────────────────────────────────────────────────────

export interface ConformanceConfig {
  /** A layer that provides Wire. */
  readonly wireLayer: Layer.Layer<Wire>
  /** Skip categories that are HTTP-only or not yet implemented. */
  readonly skipCategories?: ReadonlyArray<ConformanceCategory>
}

export type ConformanceCategory =
  | "lifecycle"
  | "offsets"
  | "json-framing"
  | "raw-framing"
  | "long-poll"
  | "producer-idempotency"
  | "stream-closure"

export const runConformance = (config: ConformanceConfig): void => {
  const skip = new Set(config.skipCategories ?? [])

  const provided = <A, E>(eff: Effect.Effect<A, E, Wire>) =>
    Effect.runPromise(eff.pipe(Effect.provide(config.wireLayer)) as Effect.Effect<A, E, never>)

  // ── Stream Lifecycle ──────────────────────────────────────────────────────
  if (!skip.has("lifecycle")) {
    describe("conformance > stream lifecycle", () => {
      it("PUT creates a stream, returns created: true", async () => {
        const sid = makeStreamId("create-basic")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            const r = yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            expect(r.created).toBe(true)
            expect(r.streamId).toBe(sid)
            expect(r.contentType).toBe("text/plain")
          }),
        )
      })

      it("PUT is idempotent on identical content-type", async () => {
        const sid = makeStreamId("create-idempotent")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            const ct = trustContentType("application/octet-stream")
            const r1 = yield* wire.put({ streamId: sid, contentType: ct })
            expect(r1.created).toBe(true)
            const r2 = yield* wire.put({ streamId: sid, contentType: ct })
            expect(r2.created).toBe(false)
          }),
        )
      })

      it("PUT with conflicting content-type fails", async () => {
        const sid = makeStreamId("create-conflict")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            // Subsequent PUT with different content-type should fail.
            // (We bridge it via Effect.die in InMemoryWire; just verify the
            // Effect doesn't succeed.)
            const result = yield* Effect.exit(
              wire.put({
                streamId: sid,
                contentType: trustContentType("application/json"),
              }),
            )
            expect(result._tag).toBe("Failure")
          }),
        )
      })

      it("DELETE removes a stream", async () => {
        const sid = makeStreamId("delete-basic")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            const d = yield* wire.delete({ streamId: sid })
            expect(d.deleted).toBe(true)
          }),
        )
      })

      it("DELETE on non-existent stream returns deleted: false (no error)", async () => {
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            const d = yield* wire.delete({ streamId: makeStreamId("delete-missing") })
            expect(d.deleted).toBe(false)
          }),
        )
      })

      it("HEAD on missing stream → StreamNotFoundError", async () => {
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            const r = yield* Effect.exit(
              wire.head({ streamId: makeStreamId("head-missing") }),
            )
            expect(r._tag).toBe("Failure")
            if (r._tag === "Failure") {
              expect(JSON.stringify(r.cause)).toContain("StreamNotFoundError")
            }
          }),
        )
      })

      it("HEAD on existing stream returns content-type and closed=false", async () => {
        const sid = makeStreamId("head-basic")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("application/json"),
            })
            const m = yield* wire.head({ streamId: sid })
            expect(m.contentType).toBe("application/json")
            expect(m.closed).toBe(false)
          }),
        )
      })

      it("recreate after delete starts fresh", async () => {
        const sid = makeStreamId("delete-recreate")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            yield* wire.post({
              streamId: sid,
              body: TEXT_ENCODER.encode("first"),
            })
            yield* wire.delete({ streamId: sid })
            const r = yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            expect(r.created).toBe(true)
            const meta = yield* wire.head({ streamId: sid })
            expect(meta.nextOffset).toBeUndefined()
          }),
        )
      })
    })
  }

  // ── Raw-bytes framing ─────────────────────────────────────────────────────
  if (!skip.has("raw-framing")) {
    describe("conformance > raw-bytes framing", () => {
      it("POST appends raw bytes; GET returns concatenation", async () => {
        const sid = makeStreamId("raw-concat")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            yield* wire.post({ streamId: sid, body: TEXT_ENCODER.encode("hello") })
            yield* wire.post({ streamId: sid, body: TEXT_ENCODER.encode(" world") })
            const r = yield* Effect.scoped(
              Effect.gen(function* () {
                const out = yield* wire.get({ streamId: sid, position: "-1" })
                return yield* collectBody(out.body)
              }),
            )
            expect(r).toBe("hello world")
          }),
        )
      })

      it("GET on empty stream returns empty body", async () => {
        const sid = makeStreamId("raw-empty")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("application/octet-stream"),
            })
            const r = yield* Effect.scoped(
              Effect.gen(function* () {
                const out = yield* wire.get({ streamId: sid, position: "-1" })
                expect(out.upToDate).toBe(true)
                return yield* collectBody(out.body)
              }),
            )
            expect(r).toBe("")
          }),
        )
      })
    })
  }

  // ── JSON framing ──────────────────────────────────────────────────────────
  if (!skip.has("json-framing")) {
    describe("conformance > JSON framing", () => {
      it("POST single JSON object stores as 1 message; GET returns [obj]", async () => {
        const sid = makeStreamId("json-single")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("application/json"),
            })
            yield* wire.post({
              streamId: sid,
              body: TEXT_ENCODER.encode(JSON.stringify({ event: "a" })),
            })
            const r = yield* Effect.scoped(
              Effect.gen(function* () {
                const out = yield* wire.get({ streamId: sid, position: "-1" })
                return yield* collectBody(out.body)
              }),
            )
            expect(JSON.parse(r)).toEqual([{ event: "a" }])
          }),
        )
      })

      it("POST JSON array flattens one level (3 messages); GET returns array", async () => {
        const sid = makeStreamId("json-array-flatten")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("application/json"),
            })
            yield* wire.post({
              streamId: sid,
              body: TEXT_ENCODER.encode(
                JSON.stringify([{ a: 1 }, { b: 2 }, { c: 3 }]),
              ),
            })
            const r = yield* Effect.scoped(
              Effect.gen(function* () {
                const out = yield* wire.get({ streamId: sid, position: "-1" })
                return yield* collectBody(out.body)
              }),
            )
            expect(JSON.parse(r)).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
          }),
        )
      })

      it("nested arrays NOT flattened recursively (only one level)", async () => {
        const sid = makeStreamId("json-nested")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("application/json"),
            })
            // Outer array of 2 elements; each element is itself an array.
            // After flattening one level, we have 2 messages, each an array.
            yield* wire.post({
              streamId: sid,
              body: TEXT_ENCODER.encode(JSON.stringify([[1, 2], [3, 4]])),
            })
            const r = yield* Effect.scoped(
              Effect.gen(function* () {
                const out = yield* wire.get({ streamId: sid, position: "-1" })
                return yield* collectBody(out.body)
              }),
            )
            expect(JSON.parse(r)).toEqual([
              [1, 2],
              [3, 4],
            ])
          }),
        )
      })

      it("POST invalid JSON fails", async () => {
        const sid = makeStreamId("json-invalid")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("application/json"),
            })
            const r = yield* Effect.exit(
              wire.post({
                streamId: sid,
                body: TEXT_ENCODER.encode("not valid json {"),
              }),
            )
            expect(r._tag).toBe("Failure")
          }),
        )
      })

      it("POST empty JSON array fails", async () => {
        const sid = makeStreamId("json-empty-array")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("application/json"),
            })
            const r = yield* Effect.exit(
              wire.post({
                streamId: sid,
                body: TEXT_ENCODER.encode("[]"),
              }),
            )
            expect(r._tag).toBe("Failure")
          }),
        )
      })

      it("application/ld+json (json suffix) uses JSON framing", async () => {
        const sid = makeStreamId("ld-json")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("application/ld+json"),
            })
            yield* wire.post({
              streamId: sid,
              body: TEXT_ENCODER.encode(JSON.stringify([{ x: 1 }, { y: 2 }])),
            })
            const r = yield* Effect.scoped(
              Effect.gen(function* () {
                const out = yield* wire.get({ streamId: sid, position: "-1" })
                return yield* collectBody(out.body)
              }),
            )
            expect(JSON.parse(r)).toEqual([{ x: 1 }, { y: 2 }])
          }),
        )
      })

      it("GET empty range returns []", async () => {
        const sid = makeStreamId("json-empty-range")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("application/json"),
            })
            const r = yield* Effect.scoped(
              Effect.gen(function* () {
                const out = yield* wire.get({ streamId: sid, position: "-1" })
                return yield* collectBody(out.body)
              }),
            )
            expect(JSON.parse(r)).toEqual([])
          }),
        )
      })
    })
  }

  // ── Offsets & reads ───────────────────────────────────────────────────────
  if (!skip.has("offsets")) {
    describe("conformance > offsets and reads", () => {
      it("offsets are lex-sortable across appends", async () => {
        const sid = makeStreamId("offset-lex")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            const r1 = yield* wire.post({ streamId: sid, body: TEXT_ENCODER.encode("a") })
            const r2 = yield* wire.post({ streamId: sid, body: TEXT_ENCODER.encode("bb") })
            const r3 = yield* wire.post({ streamId: sid, body: TEXT_ENCODER.encode("ccc") })
            expect(r1.nextOffset < r2.nextOffset).toBe(true)
            expect(r2.nextOffset < r3.nextOffset).toBe(true)
          }),
        )
      })

      it("read with `now` sentinel skips historical data", async () => {
        const sid = makeStreamId("offset-now")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            yield* wire.post({ streamId: sid, body: TEXT_ENCODER.encode("history") })
            const r = yield* Effect.scoped(
              Effect.gen(function* () {
                const out = yield* wire.get({ streamId: sid, position: "now" })
                return yield* collectBody(out.body)
              }),
            )
            expect(r).toBe("")
          }),
        )
      })

      it("read after specific offset returns only newer messages", async () => {
        const sid = makeStreamId("offset-resume")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            const r1 = yield* wire.post({
              streamId: sid,
              body: TEXT_ENCODER.encode("first"),
            })
            yield* wire.post({ streamId: sid, body: TEXT_ENCODER.encode("second") })
            yield* wire.post({ streamId: sid, body: TEXT_ENCODER.encode("third") })
            const out = yield* Effect.scoped(
              Effect.gen(function* () {
                const o = yield* wire.get({
                  streamId: sid,
                  position: r1.nextOffset,
                })
                return yield* collectBody(o.body)
              }),
            )
            expect(out).toBe("secondthird")
          }),
        )
      })

      it("upToDate is true when caught up", async () => {
        const sid = makeStreamId("offset-uptodate")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            yield* wire.post({ streamId: sid, body: TEXT_ENCODER.encode("a") })
            yield* Effect.scoped(
              Effect.gen(function* () {
                const out = yield* wire.get({ streamId: sid, position: "-1" })
                expect(out.upToDate).toBe(true)
              }),
            )
          }),
        )
      })
    })
  }

  // ── Producer idempotency ──────────────────────────────────────────────────
  if (!skip.has("producer-idempotency")) {
    describe("conformance > producer idempotency", () => {
      it("duplicate (epoch, seq) returns same offset; no new write", async () => {
        const sid = makeStreamId("producer-dup")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            const producer = {
              producerId: trustProducerId("p1"),
              epoch: trustEpoch(0),
              seq: trustSeq(0),
            }
            const r1 = yield* wire.post({
              streamId: sid,
              body: TEXT_ENCODER.encode("alpha"),
              producer,
            })
            expect(r1.duplicate).toBe(false)
            // Re-POST with same (producerId, epoch, seq).
            const r2 = yield* wire.post({
              streamId: sid,
              body: TEXT_ENCODER.encode("alpha"),
              producer,
            })
            expect(r2.duplicate).toBe(true)
            expect(r2.nextOffset).toBe(r1.nextOffset)
            // Verify there's only one message in the stream.
            const body = yield* Effect.scoped(
              Effect.gen(function* () {
                const out = yield* wire.get({ streamId: sid, position: "-1" })
                return yield* collectBody(out.body)
              }),
            )
            expect(body).toBe("alpha")
          }),
        )
      })

      it("stale epoch (lower than seen) → StaleEpochError", async () => {
        const sid = makeStreamId("producer-stale")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            // Establish epoch=1
            yield* wire.post({
              streamId: sid,
              body: TEXT_ENCODER.encode("first"),
              producer: {
                producerId: trustProducerId("p1"),
                epoch: trustEpoch(1),
                seq: trustSeq(0),
              },
            })
            // Stale epoch=0 → fail
            const r = yield* Effect.exit(
              wire.post({
                streamId: sid,
                body: TEXT_ENCODER.encode("stale"),
                producer: {
                  producerId: trustProducerId("p1"),
                  epoch: trustEpoch(0),
                  seq: trustSeq(1),
                },
              }),
            )
            expect(r._tag).toBe("Failure")
            if (r._tag === "Failure") {
              expect(JSON.stringify(r.cause)).toContain("StaleEpochError")
            }
          }),
        )
      })

      it("sequence gap → SequenceGapError", async () => {
        const sid = makeStreamId("producer-gap")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            yield* wire.post({
              streamId: sid,
              body: TEXT_ENCODER.encode("zero"),
              producer: {
                producerId: trustProducerId("p1"),
                epoch: trustEpoch(0),
                seq: trustSeq(0),
              },
            })
            // Gap: seq=2 (expected seq=1)
            const r = yield* Effect.exit(
              wire.post({
                streamId: sid,
                body: TEXT_ENCODER.encode("gap"),
                producer: {
                  producerId: trustProducerId("p1"),
                  epoch: trustEpoch(0),
                  seq: trustSeq(2),
                },
              }),
            )
            expect(r._tag).toBe("Failure")
            if (r._tag === "Failure") {
              expect(JSON.stringify(r.cause)).toContain("SequenceGapError")
            }
          }),
        )
      })

      it("higher epoch unfences (accepts the writer)", async () => {
        const sid = makeStreamId("producer-unfence")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            yield* wire.post({
              streamId: sid,
              body: TEXT_ENCODER.encode("e0"),
              producer: {
                producerId: trustProducerId("p1"),
                epoch: trustEpoch(0),
                seq: trustSeq(0),
              },
            })
            // Higher epoch always accepted
            const r = yield* wire.post({
              streamId: sid,
              body: TEXT_ENCODER.encode("e1"),
              producer: {
                producerId: trustProducerId("p1"),
                epoch: trustEpoch(1),
                seq: trustSeq(0),
              },
            })
            expect(r.duplicate).toBe(false)
          }),
        )
      })
    })
  }

  // ── Stream closure ────────────────────────────────────────────────────────
  if (!skip.has("stream-closure")) {
    describe("conformance > stream closure", () => {
      it("POST with streamClosed: true closes the stream", async () => {
        const sid = makeStreamId("close-basic")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            yield* wire.post({
              streamId: sid,
              body: TEXT_ENCODER.encode("final"),
              streamClosed: true,
            })
            const meta = yield* wire.head({ streamId: sid })
            expect(meta.closed).toBe(true)
          }),
        )
      })

      it("POST after close → StreamClosedError", async () => {
        const sid = makeStreamId("close-post-after")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            yield* wire.post({
              streamId: sid,
              body: TEXT_ENCODER.encode("a"),
              streamClosed: true,
            })
            const r = yield* Effect.exit(
              wire.post({
                streamId: sid,
                body: TEXT_ENCODER.encode("after-close"),
              }),
            )
            expect(r._tag).toBe("Failure")
            if (r._tag === "Failure") {
              expect(JSON.stringify(r.cause)).toContain("StreamClosedError")
            }
          }),
        )
      })

      it("GET after close still works; closed=true in response", async () => {
        const sid = makeStreamId("close-get-after")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            yield* wire.post({
              streamId: sid,
              body: TEXT_ENCODER.encode("data"),
              streamClosed: true,
            })
            yield* Effect.scoped(
              Effect.gen(function* () {
                const out = yield* wire.get({ streamId: sid, position: "-1" })
                expect(out.closed).toBe(true)
                const body = yield* collectBody(out.body)
                expect(body).toBe("data")
              }),
            )
          }),
        )
      })
    })
  }

  // ── Long-poll ─────────────────────────────────────────────────────────────
  if (!skip.has("long-poll")) {
    describe("conformance > long-poll", () => {
      it("returns immediately if data is already available", async () => {
        const sid = makeStreamId("longpoll-immediate")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            yield* wire.post({ streamId: sid, body: TEXT_ENCODER.encode("now") })
            const t0 = Date.now()
            const body = yield* Effect.scoped(
              Effect.gen(function* () {
                const out = yield* wire.get({
                  streamId: sid,
                  position: "-1",
                  live: "long-poll",
                  timeout: 1000,
                })
                return yield* collectBody(out.body)
              }),
            )
            const elapsed = Date.now() - t0
            expect(body).toBe("now")
            expect(elapsed).toBeLessThan(500)
          }),
        )
      })

      it("on timeout returns empty body, upToDate: true", async () => {
        const sid = makeStreamId("longpoll-timeout")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            const t0 = Date.now()
            const out = yield* Effect.scoped(
              Effect.gen(function* () {
                const o = yield* wire.get({
                  streamId: sid,
                  position: "-1",
                  live: "long-poll",
                  timeout: 200,
                })
                const body = yield* collectBody(o.body)
                return { o, body }
              }),
            )
            const elapsed = Date.now() - t0
            expect(out.body).toBe("")
            expect(out.o.upToDate).toBe(true)
            expect(elapsed).toBeGreaterThanOrEqual(150)
            expect(elapsed).toBeLessThan(2000)
          }),
        )
      })

      it("returns when data arrives mid-poll", async () => {
        const sid = makeStreamId("longpoll-arrival")
        await provided(
          Effect.gen(function* () {
            const wire = yield* Wire
            yield* wire.put({
              streamId: sid,
              contentType: trustContentType("text/plain"),
            })
            // Fork a fiber that POSTs after a delay
            const writer = Effect.gen(function* () {
              yield* Effect.sleep("100 millis")
              yield* wire.post({
                streamId: sid,
                body: TEXT_ENCODER.encode("late"),
              })
            })
            const t0 = Date.now()
            const [body] = yield* Effect.all(
              [
                Effect.scoped(
                  Effect.gen(function* () {
                    const out = yield* wire.get({
                      streamId: sid,
                      position: "-1",
                      live: "long-poll",
                      timeout: 5000,
                    })
                    return yield* collectBody(out.body)
                  }),
                ),
                writer,
              ],
              { concurrency: "unbounded" },
            )
            const elapsed = Date.now() - t0
            expect(body).toBe("late")
            expect(elapsed).toBeLessThan(2000)
          }),
        )
      })
    })
  }
}
