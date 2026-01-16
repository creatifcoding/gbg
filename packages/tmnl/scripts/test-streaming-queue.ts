#!/usr/bin/env bun
/**
 * Test streaming with Queue-based producer/consumer pattern.
 *
 * The issue with Stream.asyncPush is it buffers all emissions until producer completes.
 * This test uses a Queue with concurrent fibers to process items as they arrive.
 *
 * Run with: bun run scripts/test-streaming-queue.ts
 */

import { Effect, Stream, Queue, Fiber, Option, pipe, Chunk } from "effect"
import { Schema } from "effect"

// Inline the minimal schema needed
const PatchOpSchema = Schema.Literal("add", "remove", "replace", "set")
const JsonPatchSchema = Schema.Struct({
  op: PatchOpSchema,
  path: Schema.String,
  value: Schema.optional(Schema.Unknown),
})
type JsonPatch = Schema.Schema.Type<typeof JsonPatchSchema>
const decodeJsonPatchSync = Schema.decodeUnknownSync(JsonPatchSchema)

// Parse SSE or NDJSON line
const parsePatchLine = (line: string): Option.Option<JsonPatch> => {
  let trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("//")) {
    return Option.none()
  }
  if (trimmed.startsWith("data:")) {
    trimmed = trimmed.slice(5).trim()
    if (!trimmed) return Option.none()
  }
  try {
    const raw = JSON.parse(trimmed)
    const patch = decodeJsonPatchSync(raw)
    return Option.some(patch)
  } catch {
    return Option.none()
  }
}

// Producer: fetches and pushes patches to queue
const producer = (queue: Queue.Queue<Option.Option<JsonPatch>>, url: string, body: unknown) =>
  Effect.gen(function* () {
    yield* Effect.log("[PRODUCER] Starting fetch...")

    const response = yield* Effect.tryPromise({
      try: () => fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      catch: (e) => e instanceof Error ? e : new Error(String(e))
    })

    if (!response.ok) {
      return yield* Effect.fail(new Error(`HTTP error: ${response.status}`))
    }

    const reader = response.body?.getReader()
    if (!reader) {
      return yield* Effect.fail(new Error("No response body"))
    }

    const decoder = new TextDecoder()
    let buffer = ""
    let patchCount = 0

    while (true) {
      const { done, value } = yield* Effect.tryPromise({
        try: () => reader.read(),
        catch: (e) => e instanceof Error ? e : new Error(String(e))
      })

      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      yield* Effect.log(`[PRODUCER] Chunk: ${chunk.length} bytes`)
      buffer += chunk

      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const maybePatch = parsePatchLine(line)
        if (Option.isSome(maybePatch)) {
          patchCount++
          yield* Effect.log(`[PRODUCER] Enqueue patch #${patchCount}: ${maybePatch.value.path}`)
          yield* Queue.offer(queue, Option.some(maybePatch.value))
        }
      }
    }

    // Handle remaining buffer
    if (buffer.trim()) {
      const maybePatch = parsePatchLine(buffer)
      if (Option.isSome(maybePatch)) {
        patchCount++
        yield* Effect.log(`[PRODUCER] Enqueue final patch #${patchCount}: ${maybePatch.value.path}`)
        yield* Queue.offer(queue, Option.some(maybePatch.value))
      }
    }

    // Signal completion
    yield* Effect.log("[PRODUCER] Done, signaling completion")
    yield* Queue.offer(queue, Option.none())
  })

// Consumer: processes patches from queue as they arrive
const consumer = (queue: Queue.Queue<Option.Option<JsonPatch>>, startTime: number) =>
  Effect.gen(function* () {
    let patchCount = 0

    while (true) {
      const item = yield* Queue.take(queue)

      if (Option.isNone(item)) {
        yield* Effect.log("[CONSUMER] Received completion signal")
        break
      }

      patchCount++
      const elapsed = Date.now() - startTime
      yield* Effect.log(`[CONSUMER] Patch #${patchCount} at ${elapsed}ms: ${item.value.op} ${item.value.path}`)
    }

    return patchCount
  })

// Main test with concurrent producer/consumer
const main = Effect.gen(function* () {
  yield* Effect.log("=== Queue-based Streaming Test ===")
  yield* Effect.log("Testing concurrent producer/consumer pattern...")
  yield* Effect.log("")

  const url = "http://localhost:7682/ui-generate"
  const body = { prompt: "Create a simple hello card" }
  const startTime = Date.now()

  // Create unbounded queue
  const queue = yield* Queue.unbounded<Option.Option<JsonPatch>>()

  // Fork producer and consumer to run concurrently
  const producerFiber = yield* Effect.fork(producer(queue, url, body))
  const consumerFiber = yield* Effect.fork(consumer(queue, startTime))

  // Wait for both to complete
  yield* Fiber.join(producerFiber)
  const patchCount = yield* Fiber.join(consumerFiber)

  const totalTime = Date.now() - startTime
  yield* Effect.log("")
  yield* Effect.log(`=== Summary ===`)
  yield* Effect.log(`Total patches: ${patchCount}`)
  yield* Effect.log(`Total time: ${totalTime}ms`)
})

Effect.runPromise(main).catch(console.error)
