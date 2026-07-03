#!/usr/bin/env bun
/**
 * Bedside-vitals dashboard — TYPED via Phase 2.5b (connectTypedById).
 *
 * The MAGIC version: pass only the streamId; the schema is auto-fetched
 * from the running PCT registry via the bundled SchemaResolverLayer.
 *
 * Pipeline at startup:
 *   1. Lnks.connectTypedById<HeartRate>(streamId)
 *   2. Internally: Wire.head -> Schema-Id -> PactClient.fetchSchema
 *      -> SchemaRepresentation.toSchema -> typed handle
 *   3. Subscribe / poll latest, render each typed value
 *
 * Run:
 *   bun run packages/pct/examples/tracer/dashboard.ts
 *
 * Env:
 *   BASE_URL  default http://localhost:9090   (one host for PCT + Lnk)
 *   STREAM_ID default vitals.hr
 */

import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"

import { StreamId } from "@tmnl/lnk/contracts"
import { Lnks } from "@tmnl/lnk/services/lnks"
import { HttpWire } from "@tmnl/lnk/services/wire/http"

import { schemaResolverLayer } from "@tmnl/pct/client"

// ─── Config ────────────────────────────────────────────────────────────────

const BASE_URL = process.env.BASE_URL ?? "http://localhost:9090"
const STREAM_ID = StreamId.trust(process.env.STREAM_ID ?? "vitals.hr")

// ─── Type the expected payload at the call site ─────────────────────────────

// We import this purely for TypeScript inference at the connectTypedById<T>
// call site. The actual runtime schema lives on the server's PCT registry
// and is fetched by the resolver. Compile-time and runtime agree if the
// registry's schema matches this declaration.
interface HeartRate {
  readonly bpm: number
  readonly observedAt: string
  readonly deviceId: string
  readonly patientId: string
}

// ─── Layer composition ─────────────────────────────────────────────────────

// One HttpClient feeds BOTH Lnk's wire transport AND the SchemaResolver's
// PactClient — they multiplex over the same Fetch service.
const AppLayer = Layer.mergeAll(
  Lnks.layer(),
  schemaResolverLayer({ baseUrl: BASE_URL }),
).pipe(
  Layer.provide(HttpWire.layer({ baseUrl: BASE_URL })),
  Layer.provide(FetchHttpClient.layer),
)

// ─── Program ────────────────────────────────────────────────────────────────

const program = Effect.gen(function* () {
  yield* Console.log(`[dashboard] BASE=${BASE_URL} STREAM=${STREAM_ID}`)
  yield* Console.log(
    `[dashboard] Connecting via connectTypedById<HeartRate>(streamId)…`,
  )
  yield* Console.log(
    `[dashboard]   (auto-fetches schema from ${BASE_URL}/schemas/<id>)`,
  )

  const lnks = yield* Lnks
  const lnk = yield* lnks.connectTypedById<HeartRate>(STREAM_ID, {
    pollTimeoutMs: 50,
  })

  yield* Console.log(
    `[dashboard] Schema resolved + typed handle bound. Polling latest…`,
  )
  yield* Console.log(``)

  // Let the driver fiber settle, then poll latest every second.
  yield* Effect.sleep("200 millis")
  let lastBpm: number | null = null
  yield* Effect.repeat(
    Effect.gen(function* () {
      const current = yield* lnk.latest
      if (current._tag === "Some") {
        const v = current.value
        // Only log when the reading changes (cheap dedup)
        if (v.bpm !== lastBpm) {
          lastBpm = v.bpm
          yield* Console.log(
            `[dashboard]  ❤ ${String(v.bpm).padStart(3, " ")} bpm  ` +
              `observed=${v.observedAt}  device=${v.deviceId}  patient=${v.patientId}`,
          )
        }
      }
    }),
    Schedule.spaced("500 millis"),
  )
})

// ─── Run ────────────────────────────────────────────────────────────────────

Effect.runPromise(
  Effect.scoped(program).pipe(Effect.provide(AppLayer)),
).catch((err) => {
  console.error("[dashboard] failed:", err)
  process.exit(1)
})
