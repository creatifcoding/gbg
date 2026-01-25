#!/usr/bin/env bun
/**
 * Test progressive streaming with realistic network chunk delays
 */

import { Effect, Stream, Queue, Duration, pipe, Fiber } from "effect"
import { processPatches, type JsonPatch } from "@/lib/json-render/core"

const main = Effect.gen(function* () {
  yield* Effect.log("=== Network Chunk Simulation Test ===")

  const startTime = Date.now()
  const emissionTimes: { time: number; elements: number; root: string }[] = []

  const queue = yield* Queue.unbounded<JsonPatch>()

  const producer = Effect.gen(function* () {
    // Chunk 1
    yield* Effect.log("[PRODUCER] Chunk 1")
    yield* Queue.offer(queue, { op: "set", path: "/root", value: "container" })
    yield* Queue.offer(queue, { op: "add", path: "/elements/container", value: { key: "container", type: "Container", props: {}, children: ["card1"] } })
    yield* Queue.offer(queue, { op: "add", path: "/elements/card1", value: { key: "card1", type: "Card", props: { title: "Loading..." } } })

    yield* Effect.sleep(Duration.millis(50))

    // Chunk 2
    yield* Effect.log("[PRODUCER] Chunk 2")
    yield* Queue.offer(queue, { op: "replace", path: "/elements/card1", value: { key: "card1", type: "Card", props: { title: "Hello" } } })
    yield* Queue.offer(queue, { op: "add", path: "/elements/button1", value: { key: "button1", type: "Button", props: { label: "Click" } } })

    yield* Effect.sleep(Duration.millis(50))

    // Chunk 3
    yield* Effect.log("[PRODUCER] Chunk 3")
    yield* Queue.offer(queue, { op: "add", path: "/elements/footer", value: { key: "footer", type: "Text", props: { text: "Done" } } })

    yield* Queue.shutdown(queue)
  })

  const consumer = Effect.gen(function* () {
    yield* pipe(
      Stream.fromQueue(queue),
      (s) => processPatches(s),
      Stream.runForEach((tree) =>
        Effect.sync(() => {
          const elapsed = Date.now() - startTime
          emissionTimes.push({ time: elapsed, elements: Object.keys(tree.elements).length, root: tree.root ?? "" })
          console.log(`[CONSUMER] ${elapsed}ms - ${Object.keys(tree.elements).length} elements`)
        })
      )
    )
  })

  // Fork BOTH first, then join both - so they run concurrently
  const pFiber = yield* Effect.fork(producer)
  const cFiber = yield* Effect.fork(consumer)
  yield* Fiber.join(pFiber)
  yield* Fiber.join(cFiber)

  yield* Effect.log(`\n=== Result: ${emissionTimes.length} emissions ===`)
  yield* Effect.log(`Progressive: ${emissionTimes.length > 1 ? "YES ✓" : "NO ✗"}`)
})

Effect.runPromise(main).catch(console.error)
