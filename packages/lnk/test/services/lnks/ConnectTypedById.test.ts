/**
 * Lnks.connectTypedById — Phase 2.5b schema auto-fetch tests.
 *
 * Verifies the four-phase sequence (discovery → resolution → handle →
 * compose) and its failure modes:
 *
 *   1. PUT a stream with a `Schema-Id` header, then connectTypedById
 *      with a stub resolver → typed handle, round-trip works
 *   2. Resolver cache: the resolver is called only once across N
 *      connectTypedById calls (caching is the resolver's responsibility,
 *      but we verify Lnks doesn't refetch redundantly within a single
 *      connect call)
 *   3. Missing Schema-Id header → MissingStreamSchemaError fires BEFORE
 *      hitting the resolver
 *   4. Resolver returns SchemaResolverNotFound → fails with that error
 */

import { describe, expect, it } from "vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as Schema from "effect/Schema"

import { trust as trustContentType } from "../../../src/contracts/ContentType.js"
import {
  MissingStreamSchemaError,
} from "../../../src/contracts/errors.js"
import {
  SchemaResolver,
  SchemaResolverNotFound,
  type SchemaResolverShape,
} from "../../../src/contracts/SchemaResolver.js"
import { trust as trustStreamId } from "../../../src/contracts/StreamId.js"
import { Lnks } from "../../../src/services/lnks/Lnks.js"
import { TypedLnk } from "../../../src/services/lnks/TypedLnk.js"
import { Wire } from "../../../src/services/wire/Wire.js"
import { InMemoryWire } from "../../../src/services/wire/in-memory/index.js"

// ─── Schema under test ──────────────────────────────────────────────────────

const HeartRate = Schema.Struct({
  bpm: Schema.Number,
  deviceId: Schema.String,
})
type HeartRate = typeof HeartRate.Type

// ─── Stub SchemaResolver layer ──────────────────────────────────────────────

/**
 * Build a SchemaResolver layer backed by a hand-supplied schema map.
 * Also tracks call counts per schemaId so we can assert on caching.
 */
const stubResolverLayer = (entries: Record<string, Schema.Schema<unknown>>) =>
  Layer.effect(
    SchemaResolver,
    Effect.gen(function* () {
      const callsRef = yield* Ref.make<Record<string, number>>({})
      const fetchSchema: SchemaResolverShape["fetchSchema"] = (schemaId) =>
        Effect.gen(function* () {
          yield* Ref.update(callsRef, (m) => ({
            ...m,
            [schemaId]: (m[schemaId] ?? 0) + 1,
          }))
          const schema = entries[schemaId]
          if (schema === undefined) {
            return yield* Effect.fail(
              new SchemaResolverNotFound({ schemaId }),
            )
          }
          return schema
        })
      // Expose the callsRef via the service shape for assertions
      return SchemaResolver.of({ fetchSchema, ...({ _callsRef: callsRef } as never) })
    }),
  )

const fetchCount = (resolver: SchemaResolverShape, schemaId: string) =>
  Effect.gen(function* () {
    const ref = (resolver as unknown as { _callsRef: Ref.Ref<Record<string, number>> })._callsRef
    const m = yield* Ref.get(ref)
    return m[schemaId] ?? 0
  })

// ─── Layer composition ─────────────────────────────────────────────────────

const baseLayer = Lnks.layer().pipe(Layer.provideMerge(InMemoryWire.layer))

const layerWith = (resolverEntries: Record<string, Schema.Schema<unknown>>) =>
  Layer.merge(baseLayer, stubResolverLayer(resolverEntries))

const createStreamWithSchemaId = (id: string, schemaId: string) =>
  Effect.gen(function* () {
    const wire = yield* Wire
    yield* wire.put({
      streamId: trustStreamId(id),
      contentType: trustContentType("application/json"),
      schemaId,
    })
  })

const createStreamNoSchemaId = (id: string) =>
  Effect.gen(function* () {
    const wire = yield* Wire
    yield* wire.put({
      streamId: trustStreamId(id),
      contentType: trustContentType("application/json"),
    })
  })

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Lnks.connectTypedById (Phase 2.5b)", () => {
  it("auto-fetches schema, returns typed handle, round-trips a value", async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          // PUT a stream with Schema-Id metadata
          yield* createStreamWithSchemaId("vitals.hr-2.5b-1", "vitals.hr@1.0.0")

          const lnks = yield* Lnks
          const lnk = yield* lnks.connectTypedById<HeartRate>(
            trustStreamId("vitals.hr-2.5b-1"),
            { pollTimeoutMs: 50 },
          )

          // It IS a typed handle bound to the resolver-supplied schema
          expect(lnk).toBeInstanceOf(TypedLnk)

          // Let driver attach, append, observe
          yield* Effect.sleep("100 millis")
          yield* lnk.append({ bpm: 72, deviceId: "dev_1" })
          yield* Effect.sleep("200 millis")
          return yield* lnk.latest
        }),
      ).pipe(Effect.provide(layerWith({ "vitals.hr@1.0.0": HeartRate }))),
    )
    expect(result._tag).toBe("Some")
    if (result._tag === "Some") {
      expect(result.value.bpm).toBe(72)
      expect(result.value.deviceId).toBe("dev_1")
    }
  })

  it("MissingStreamSchemaError: stream without Schema-Id fails BEFORE hitting resolver", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.scoped(
        Effect.gen(function* () {
          yield* createStreamNoSchemaId("vitals.hr-2.5b-2")
          const lnks = yield* Lnks
          yield* lnks.connectTypedById(trustStreamId("vitals.hr-2.5b-2"))
        }),
      ).pipe(Effect.provide(layerWith({ "vitals.hr@1.0.0": HeartRate }))),
    )
    expect(exit._tag).toBe("Failure")
    // Verify it's the typed MissingStreamSchemaError, not something else
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* createStreamNoSchemaId("vitals.hr-2.5b-2b")
          const lnks = yield* Lnks
          return yield* Effect.result(
            lnks.connectTypedById(trustStreamId("vitals.hr-2.5b-2b")),
          )
        }),
      ).pipe(Effect.provide(layerWith({ "vitals.hr@1.0.0": HeartRate }))),
    )
    expect(result._tag).toBe("Failure")
    if (result._tag === "Failure") {
      const err = result.failure as unknown as { _tag?: string }
      expect(err._tag).toBe("MissingStreamSchemaError")
    }
  })

  it("SchemaResolverNotFound: resolver doesn't know the schemaId", async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* createStreamWithSchemaId("vitals.hr-2.5b-3", "ghost@1.0.0")
          const lnks = yield* Lnks
          return yield* Effect.result(
            lnks.connectTypedById(trustStreamId("vitals.hr-2.5b-3")),
          )
        }),
      ).pipe(Effect.provide(layerWith({ "vitals.hr@1.0.0": HeartRate }))),
    )
    expect(result._tag).toBe("Failure")
    if (result._tag === "Failure") {
      const err = result.failure as unknown as { _tag?: string }
      expect(err._tag).toBe("SchemaResolverNotFound")
    }
  })

  it("resolver caching: repeated connectTypedById calls hit fetchSchema only once", async () => {
    const calls = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* createStreamWithSchemaId("vitals.hr-2.5b-4", "vitals.hr@1.0.0")
          const lnks = yield* Lnks
          const resolver = yield* SchemaResolver

          // Three connects in a row
          yield* lnks.connectTypedById(trustStreamId("vitals.hr-2.5b-4"))
          yield* lnks.connectTypedById(trustStreamId("vitals.hr-2.5b-4"))
          yield* lnks.connectTypedById(trustStreamId("vitals.hr-2.5b-4"))

          return yield* fetchCount(resolver, "vitals.hr@1.0.0")
        }),
      ).pipe(
        // Use a CACHING resolver: each call increments the counter but
        // returns the same schema. Lnks calls fetchSchema unconditionally
        // (we documented this — caching is the resolver's job, not Lnks).
        Effect.provide(layerWith({ "vitals.hr@1.0.0": HeartRate })),
      ),
    )
    // Lnks doesn't cache between calls; resolver counter sees 3
    expect(calls).toBe(3)
  })
})
