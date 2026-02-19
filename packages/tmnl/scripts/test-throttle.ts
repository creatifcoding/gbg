#!/usr/bin/env bun
/**
 * Test throttled progressive streaming
 *
 * Simulates rapid patch arrival (like Claude streaming JSON character by character)
 * and verifies that throttling limits emissions to ~8ms intervals.
 *
 * Run with: bun scripts/test-throttle.ts
 */

import { Effect, Stream, Queue, pipe, Fiber } from "effect"
import { processPatches, type JsonPatch } from "@/lib/genifer/core"

const main = Effect.gen(function* () {
  yield* Effect.log("=== Throttled Progressive Streaming Test ===")
  yield* Effect.log("")

  const startTime = Date.now()
  const emissionTimes: number[] = []

  // Create queue for patches
  const queue = yield* Queue.unbounded<JsonPatch>()

  // Producer: Rapidly enqueue many patches (simulating Claude's character-level streaming)
  const producer = Effect.gen(function* () {
    const patches: JsonPatch[] = [
      // Simulate Claude streaming JSON character-by-character
      // This would normally produce 100+ patches in milliseconds
      { op: "set", path: "/root", value: "m" },
      { op: "set", path: "/root", value: "ma" },
      { op: "set", path: "/root", value: "mai" },
      { op: "set", path: "/root", value: "main" },
      { op: "set", path: "/root", value: "mainC" },
      { op: "set", path: "/root", value: "mainCo" },
      { op: "set", path: "/root", value: "mainCon" },
      { op: "set", path: "/root", value: "mainCont" },
      { op: "set", path: "/root", value: "mainConta" },
      { op: "set", path: "/root", value: "mainContai" },
      { op: "set", path: "/root", value: "mainContain" },
      { op: "set", path: "/root", value: "mainContaine" },
      { op: "set", path: "/root", value: "mainContainer" },
      { op: "add", path: "/elements/mainContainer", value: { key: "mainContainer", type: "Container", props: {} } },
      { op: "add", path: "/elements/card1", value: { key: "card1", type: "Card", props: { title: "H" } } },
      { op: "replace", path: "/elements/card1", value: { key: "card1", type: "Card", props: { title: "He" } } },
      { op: "replace", path: "/elements/card1", value: { key: "card1", type: "Card", props: { title: "Hel" } } },
      { op: "replace", path: "/elements/card1", value: { key: "card1", type: "Card", props: { title: "Hell" } } },
      { op: "replace", path: "/elements/card1", value: { key: "card1", type: "Card", props: { title: "Hello" } } },
      { op: "replace", path: "/elements/mainContainer", value: { key: "mainContainer", type: "Container", props: {}, children: ["card1"] } },
    ]

    // Offer all patches rapidly with minimal delay (simulating network chunks)
    for (const patch of patches) {
      yield* Queue.offer(queue, patch)
      yield* Effect.yieldNow()  // Minimal yield, patches arrive quickly
    }

    yield* Queue.shutdown(queue)
    yield* Effect.log("[PRODUCER] Done - all patches offered")
  })

  // Consumer: Process with throttling
  const consumer = Effect.gen(function* () {
    const patchStream = Stream.fromQueue(queue)

    yield* pipe(
      processPatches(patchStream),
      Stream.runForEach((tree) =>
        Effect.gen(function* () {
          const elapsed = Date.now() - startTime
          emissionTimes.push(elapsed)
          yield* Effect.log(`[CONSUMER] at ${elapsed}ms - elements: ${Object.keys(tree.elements).length}, root: ${tree.root}`)
        })
      )
    )
  })

  // Fork BOTH first for concurrent execution
  const producerFiber = yield* Effect.fork(producer)
  const consumerFiber = yield* Effect.fork(consumer)
  yield* Fiber.join(producerFiber)
  yield* Fiber.join(consumerFiber)

  // Summary
  const totalTime = Date.now() - startTime
  yield* Effect.log("")
  yield* Effect.log("=== Summary ===")
  yield* Effect.log(`Total time: ${totalTime}ms`)
  yield* Effect.log(`Total emissions: ${emissionTimes.length}`)
  yield* Effect.log(`Emission times: ${emissionTimes.join(", ")}ms`)

  // Calculate intervals between emissions
  const intervals: number[] = []
  for (let i = 1; i < emissionTimes.length; i++) {
    intervals.push(emissionTimes[i] - emissionTimes[i - 1])
  }
  if (intervals.length > 0) {
    yield* Effect.log(`Intervals: ${intervals.join(", ")}ms`)
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
    yield* Effect.log(`Average interval: ${avgInterval.toFixed(1)}ms`)
  }

  // Verify throttling is working
  // With 20 patches and 8ms throttle, we should have ~2-3 emissions if all patches arrive at once
  // Or more if patches are spread out
  const isThrottled = emissionTimes.length < 20
  yield* Effect.log(`Throttled: ${isThrottled ? "YES ✓" : "NO ✗"} (${emissionTimes.length} emissions for 20 patches)`)
})

Effect.runPromise(main).catch(console.error)
