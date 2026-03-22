#!/usr/bin/env bun
/**
 * Test processPatches with Stream.scan to verify progressive UITree emission
 *
 * Run with: bun run scripts/test-processpatches.ts
 */

import { Effect, Stream, Queue, Duration, pipe, Fiber, Chunk } from "effect"
import { processPatches, UITree, JsonPatch } from "../src/lib/genifer/core"

const main = Effect.gen(function* () {
  yield* Effect.log("=== processPatches Progressive Test ===")
  yield* Effect.log("")

  const startTime = Date.now()
  let callbackCount = 0
  const callbackTimes: number[] = []

  // Create queue and stream (simulates streamFromFetchProgressive)
  const queue = yield* Queue.unbounded<JsonPatch>()

  // Producer: enqueue patches with delays
  const producer = Effect.gen(function* () {
    const patches: JsonPatch[] = [
      { op: "set", path: "/root", value: "container" },
      { op: "add", path: "/elements/container", value: { key: "container", type: "Container", props: {}, children: ["card"] } },
      { op: "add", path: "/elements/card", value: { key: "card", type: "Card", props: { title: "Hello" }, children: [] } },
      { op: "replace", path: "/elements/card", value: { key: "card", type: "Card", props: { title: "Hello World" }, children: [] } },
      { op: "add", path: "/elements/button", value: { key: "button", type: "Button", props: { label: "Click" }, children: [] } },
    ]

    for (const patch of patches) {
      yield* Effect.sleep(Duration.millis(300))  // Simulate network delay
      yield* Effect.log(`[PRODUCER] Offering: ${patch.op} ${patch.path}`)
      yield* Queue.offer(queue, patch)
    }

    yield* Queue.shutdown(queue)
    yield* Effect.log("[PRODUCER] Done")
  })

  // Consumer: use processPatches + runForEach
  const consumer = Effect.gen(function* () {
    const patchStream = Stream.fromQueue(queue)

    yield* pipe(
      processPatches(patchStream),
      Stream.runForEach((newTree) =>
        Effect.gen(function* () {
          callbackCount++
          const elapsed = Date.now() - startTime
          callbackTimes.push(elapsed)
          yield* Effect.log(`[CALLBACK #${callbackCount}] at ${elapsed}ms - elements: ${Object.keys(newTree.elements).length}, root: ${newTree.root}`)
          yield* Effect.sleep(Duration.zero)  // Yield to event loop
        })
      )
    )
  })

  // Fork both
  const producerFiber = yield* Effect.fork(producer)
  const consumerFiber = yield* Effect.fork(consumer)

  yield* Fiber.join(producerFiber)
  yield* Fiber.join(consumerFiber)

  // Summary
  const totalTime = Date.now() - startTime
  yield* Effect.log("")
  yield* Effect.log("=== Summary ===")
  yield* Effect.log(`Total time: ${totalTime}ms`)
  yield* Effect.log(`Callbacks: ${callbackCount}`)
  yield* Effect.log(`Callback times: ${callbackTimes.join(", ")}ms`)

  const isProgressive = callbackTimes.length > 1 &&
    callbackTimes.some((t, i) => i > 0 && t - callbackTimes[i-1] > 100)

  yield* Effect.log(`Progressive: ${isProgressive ? "YES ✓" : "NO ✗"}`)
})

Effect.runPromise(main).catch(console.error)
