#!/usr/bin/env bun
/**
 * Test React incremental rendering with effect-atom
 *
 * This verifies that:
 * 1. registry.set() triggers useSyncExternalStore listeners
 * 2. React re-renders on each update (not just at the end)
 *
 * Run with: bun run scripts/test-react-incremental.tsx
 */

import { Effect, Stream, Queue, Duration, pipe, Fiber } from "effect"
import { Atom, Registry } from "@effect-atom/atom"

// Create a simple atom and registry
const countAtom = Atom.make(0)
const registry = Registry.make()

// Simulate the streaming pattern from useUIStream
const testIncrementalUpdates = Effect.gen(function* () {
  yield* Effect.log("=== React Incremental Update Test ===")
  yield* Effect.log("")

  // Create queue (same as streamFromFetchProgressive)
  const queue = yield* Queue.unbounded<number>()
  const startTime = Date.now()

  // Track when listener is called
  let listenerCallCount = 0
  const listenerCalls: number[] = []

  // Subscribe to atom (simulates useSyncExternalStore)
  const unsubscribe = registry.subscribe(countAtom, () => {
    listenerCallCount++
    const elapsed = Date.now() - startTime
    listenerCalls.push(elapsed)
    console.log(`[LISTENER] Call #${listenerCallCount} at ${elapsed}ms, value: ${registry.get(countAtom)}`)
  })

  // Producer: enqueue items with delays (simulates network chunks)
  const producer = Effect.gen(function* () {
    for (let i = 1; i <= 5; i++) {
      yield* Effect.sleep(Duration.millis(500))  // Simulate network delay
      yield* Effect.log(`[PRODUCER] Offering ${i}`)
      yield* Queue.offer(queue, i)
    }
    yield* Queue.shutdown(queue)
    yield* Effect.log("[PRODUCER] Done")
  })

  // Consumer: process items and update atom (simulates Stream.runForEach)
  const consumer = Effect.gen(function* () {
    const stream = Stream.fromQueue(queue)

    yield* pipe(
      stream,
      Stream.runForEach((value) =>
        Effect.gen(function* () {
          const elapsed = Date.now() - startTime
          yield* Effect.log(`[CONSUMER] Processing ${value} at ${elapsed}ms`)

          // This is what useUIStream does:
          registry.set(countAtom, value)
          yield* Effect.sleep(Duration.zero)  // Yield to event loop
        })
      )
    )
  })

  // Fork both (same as useUIStream)
  const producerFiber = yield* Effect.fork(producer)
  const consumerFiber = yield* Effect.fork(consumer)

  // Wait for completion
  yield* Fiber.join(producerFiber)
  yield* Fiber.join(consumerFiber)

  // Cleanup
  unsubscribe()

  // Summary
  const totalTime = Date.now() - startTime
  yield* Effect.log("")
  yield* Effect.log("=== Summary ===")
  yield* Effect.log(`Total time: ${totalTime}ms`)
  yield* Effect.log(`Listener calls: ${listenerCallCount}`)
  yield* Effect.log(`Call timestamps: ${listenerCalls.join(", ")}ms`)

  // Verify incremental
  const isIncremental = listenerCalls.length > 1 &&
    listenerCalls.some((t, i) => i > 0 && t - listenerCalls[i-1] > 100)

  yield* Effect.log(`Incremental updates: ${isIncremental ? "YES ✓" : "NO ✗"}`)

  if (!isIncremental) {
    yield* Effect.log("")
    yield* Effect.log("⚠️  Listener was NOT called incrementally!")
    yield* Effect.log("   All updates were batched together.")
  }
})

Effect.runPromise(testIncrementalUpdates).catch(console.error)
