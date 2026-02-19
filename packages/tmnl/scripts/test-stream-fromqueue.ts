#!/usr/bin/env bun
/**
 * Test Stream.fromQueue pattern for progressive streaming.
 *
 * This tests the new streamFromFetchProgressive function which uses:
 * - Queue.unbounded for producer->consumer communication
 * - Forked producer fiber that offers items then shuts down queue
 * - Stream.fromQueue which processes items immediately as they arrive
 *
 * Run with: bun run scripts/test-stream-fromqueue.ts
 */

import { Effect, Stream, pipe } from "effect"
import { streamFromFetchProgressive } from "../src/lib/genifer/core/streaming"

const main = Effect.gen(function* () {
  yield* Effect.log("=== Stream.fromQueue Progressive Test ===")
  yield* Effect.log("Testing streamFromFetchProgressive...")
  yield* Effect.log("")

  const url = "http://localhost:7682/ui-generate"
  const body = { prompt: "Create a simple hello card" }
  const startTime = Date.now()
  let patchCount = 0

  // Get the progressive stream (this also starts the producer fiber)
  const patchStream = yield* streamFromFetchProgressive(url, body)

  // Process the stream - items should arrive progressively!
  yield* pipe(
    patchStream,
    Stream.tap((patch) =>
      Effect.gen(function* () {
        patchCount++
        const elapsed = Date.now() - startTime
        yield* Effect.log(`[CONSUMER] Patch #${patchCount} at ${elapsed}ms: ${patch.op} ${patch.path}`)
      })
    ),
    Stream.runDrain
  )

  const totalTime = Date.now() - startTime
  yield* Effect.log("")
  yield* Effect.log(`=== Summary ===`)
  yield* Effect.log(`Total patches: ${patchCount}`)
  yield* Effect.log(`Total time: ${totalTime}ms`)
  yield* Effect.log(`Progressive: ${patchCount > 0 ? "YES - patches processed during streaming!" : "NO"}`)
})

Effect.runPromise(main).catch(console.error)
