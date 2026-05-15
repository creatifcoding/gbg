#!/usr/bin/env bun
/**
 * Bedside-vitals device simulator — TYPED via Phase 2.5 (TypedLnk).
 *
 * Self-contained: handles the full producer setup in one shot.
 *   1. Publishes HeartRate schema to the PCT registry
 *      (idempotent — re-running is fine; registry de-dups by id)
 *   2. PUTs the Lnk stream with Schema-Id="HeartRate@1.0.0"
 *      so consumers can auto-resolve via connectTypedById.
 *   3. Wraps the raw Lnk with the local schema (producer-side
 *      schema is colocated; we don't auto-fetch our outgoing schema).
 *   4. Loops, appending typed HeartRate values every 1s.
 *
 * Run:
 *   bun run packages/pct/examples/tracer/device.ts
 *
 * Env:
 *   BASE_URL   default http://localhost:9090
 *   STREAM_ID  default vitals.hr
 *   SCHEMA_ID  default HeartRate@1.0.0
 */

import * as Console from "effect-v4/Console"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Schedule from "effect-v4/Schedule"
import * as FetchHttpClient from "effect-v4/unstable/http/FetchHttpClient"

import { ContentType, StreamId } from "@tmnl/lnk/contracts"
import { Lnks } from "@tmnl/lnk/services/lnks"
import { HttpWire } from "@tmnl/lnk/services/wire/http"
import { Wire } from "@tmnl/lnk/services/wire"

import { PactClient, layer as pactClientLayer } from "@tmnl/pct/client"

import { HeartRate } from "./vitals.js"

// ─── Config (from env) ──────────────────────────────────────────────────────

const BASE_URL = process.env.BASE_URL ?? "http://localhost:9090"
const STREAM_ID = StreamId.trust(process.env.STREAM_ID ?? "vitals.hr")
const SCHEMA_ID = process.env.SCHEMA_ID ?? "HeartRate@1.0.0"

// ─── Layer composition ─────────────────────────────────────────────────────

// provideMerge (not provide) keeps Wire visible to the program scope,
// since device.ts uses `yield* Wire` directly for the PUT step.
const AppLayer = Layer.mergeAll(
  Lnks.layer(),
  pactClientLayer({ baseUrl: BASE_URL }),
).pipe(
  Layer.provideMerge(HttpWire.layer({ baseUrl: BASE_URL })),
  Layer.provide(FetchHttpClient.layer),
)

// ─── Helpers ────────────────────────────────────────────────────────────────

const generateReading = () => ({
  bpm: 60 + Math.floor(Math.random() * 40),
  observedAt: new Date().toISOString(),
  deviceId: "dev_pulse_001",
  patientId: "pat_alice",
})

// ─── Program ────────────────────────────────────────────────────────────────

const program = Effect.gen(function* () {
  yield* Console.log(`[device] BASE=${BASE_URL}`)
  yield* Console.log(`[device]   stream=${STREAM_ID}`)
  yield* Console.log(`[device]   schema=${SCHEMA_ID}`)
  yield* Console.log(``)

  // 1. Publish the schema (idempotent — registry de-dups).
  yield* Console.log(`[device] Publishing HeartRate schema to PCT registry…`)
  const client = yield* PactClient
  const publishResult = yield* client.publish("HeartRate", "1.0.0", HeartRate, {
    description: "Patient heart-rate reading (bpm + provenance)",
  })
  yield* Console.log(
    `[device]   schemaId=${publishResult.schemaId} ` +
      `revision=${publishResult.revision} ` +
      `originNodeId=${publishResult.originNodeId}`,
  )

  // 2. PUT the stream WITH Schema-Id metadata so connectTypedById works.
  yield* Console.log(`[device] Creating stream with Schema-Id header…`)
  const wire = yield* Wire
  const putResult = yield* wire.put({
    streamId: STREAM_ID,
    contentType: ContentType.trust("application/json"),
    schemaId: SCHEMA_ID,
  })
  yield* Console.log(
    `[device]   created=${putResult.created} contentType=${putResult.contentType}`,
  )

  // 3. Connect TYPED (producer-side: schema colocated).
  const lnks = yield* Lnks
  const lnk = yield* lnks.connectTyped(STREAM_ID, HeartRate)
  yield* Console.log(``)
  yield* Console.log(`[device] Typed handle bound. Starting reading loop…`)
  yield* Console.log(``)

  // 4. Loop: validate-encode-append every second.
  let i = 0
  yield* Effect.repeat(
    Effect.gen(function* () {
      i += 1
      // typed.append accepts the typed value directly; Schema.encodeUnknownEffect
      // inside TypedLnk validates and JSON-encodes. No need for makeUnsafe.
      const reading = generateReading()
      const result = yield* lnk.append(reading)
      yield* Console.log(
        `[device #${String(i).padStart(3, "0")}]  ` +
          `bpm=${String(reading.bpm).padStart(3, " ")}  ` +
          `observed=${reading.observedAt}  ` +
          `-> ${String(result.nextOffset).slice(0, 28)}…`,
      )
    }),
    Schedule.spaced("1 second"),
  )
})

// ─── Run ────────────────────────────────────────────────────────────────────

Effect.runPromise(
  Effect.scoped(program).pipe(Effect.provide(AppLayer)),
).catch((err: unknown) => {
  console.error("[device] failed:", err)
  process.exit(1)
})
