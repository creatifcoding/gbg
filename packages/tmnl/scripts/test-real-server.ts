#!/usr/bin/env bun
/**
 * Test against REAL cursor-server to verify end-to-end progressive streaming
 */

import { Effect, Stream, pipe, Fiber } from "effect"
import { streamFromFetchProgressive, processPatches } from "@/lib/json-render/core"

const SERVER_URL = "http://localhost:7682/ui-generate"

const main = Effect.gen(function* () {
  yield* Effect.log("=== Real Server Progressive Test ===")
  yield* Effect.log(`Hitting: ${SERVER_URL}`)

  const startTime = Date.now()
  const emissions: { time: number; elements: number; root: string }[] = []

  // Get progressive stream from real server
  const patchStream = yield* streamFromFetchProgressive(
    SERVER_URL,
    { prompt: "Create a simple card with a button" }
  )

  // Process patches and log each emission
  yield* pipe(
    processPatches(patchStream),
    Stream.runForEach((tree) =>
      Effect.sync(() => {
        const elapsed = Date.now() - startTime
        emissions.push({
          time: elapsed,
          elements: Object.keys(tree.elements).length,
          root: tree.root ?? ""
        })
        console.log(`[${elapsed}ms] ${Object.keys(tree.elements).length} elements, root: ${tree.root}`)
      })
    )
  )

  yield* Effect.log(`\n=== Result: ${emissions.length} emissions ===`)

  if (emissions.length > 0) {
    yield* Effect.log("Timeline:")
    for (const e of emissions) {
      yield* Effect.log(`  ${e.time}ms: ${e.elements} elements`)
    }

    // Check if progressive
    const isProgressive = emissions.length > 1 &&
      emissions.some((e, i) => i > 0 && e.time - emissions[i-1].time > 10)
    yield* Effect.log(`Progressive: ${isProgressive ? "YES ✓" : "NO ✗"}`)
  }
})

Effect.runPromise(main).catch(console.error)
