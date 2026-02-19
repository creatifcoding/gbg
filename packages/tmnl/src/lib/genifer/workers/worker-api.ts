/**
 * Worker API
 *
 * Effect-wrapped API for the Parse Worker.
 * Provides type-safe communication with the worker.
 *
 * @module genifer/workers/worker-api
 */

import { Effect, Stream, Deferred, Ref, Layer, Context } from "effect"
import type { JsonPatch } from "../core/schemas"
import type { ParseRequest, ParseBatchRequest, ParseResponse } from "./parse.worker"

// =============================================================================
// Types
// =============================================================================

export interface ParseWorkerService {
  /**
   * Parse an array of NDJSON lines
   */
  readonly parseLines: (lines: string[]) => Effect.Effect<JsonPatch[], Error>

  /**
   * Parse a raw chunk containing newlines
   */
  readonly parseChunk: (chunk: string) => Effect.Effect<JsonPatch[], Error>

  /**
   * Create a stream that parses chunks as they arrive
   */
  readonly parseStream: (
    chunks: Stream.Stream<string, Error>
  ) => Stream.Stream<JsonPatch, Error>

  /**
   * Terminate the worker
   */
  readonly terminate: () => Effect.Effect<void>
}

// =============================================================================
// Service Tag
// =============================================================================

export class ParseWorker extends Context.Tag("ParseWorker")<
  ParseWorker,
  ParseWorkerService
>() {}

// =============================================================================
// Implementation
// =============================================================================

const makeParseWorker = Effect.gen(function* () {
  // Track pending requests
  const pendingRef = yield* Ref.make<Map<number, Deferred.Deferred<JsonPatch[], Error>>>(
    new Map()
  )
  const idRef = yield* Ref.make(0)

  // Create worker
  let worker: Worker | null = null

  const getWorker = Effect.gen(function* () {
    if (worker) return worker

    // Browser/Vite environment
    if (typeof window !== "undefined") {
      // @ts-ignore - import.meta.url works in Vite, tsconfig doesn't recognize it
      worker = new Worker(
        new URL("./parse.worker.ts", import.meta.url),
        { type: "module" }
      )
    } else {
      // Node/Bun environment - use Worker from worker_threads
      return yield* Effect.fail(new Error("Workers not supported in this environment"))
    }

    // Set up message handler
    worker.onmessage = (event: MessageEvent<ParseResponse | { type: "ready" }>) => {
      if (event.data.type === "ready") {
        return
      }

      const response = event.data as ParseResponse
      Effect.runSync(
        Effect.gen(function* () {
          const pending = yield* Ref.get(pendingRef)
          const deferred = pending.get(response.id)
          if (deferred) {
            pending.delete(response.id)
            yield* Ref.set(pendingRef, pending)
            yield* Deferred.succeed(deferred, response.patches)
          }
        })
      )
    }

    worker.onerror = (error) => {
      console.error("[ParseWorker] Error:", error)
    }

    return worker
  })

  const sendParseRequest = (
    lines: string[]
  ): Effect.Effect<JsonPatch[], Error> =>
    Effect.gen(function* () {
      const w = yield* getWorker
      const id = yield* Ref.updateAndGet(idRef, (n) => n + 1)
      const deferred = yield* Deferred.make<JsonPatch[], Error>()

      yield* Ref.update(pendingRef, (map) => {
        map.set(id, deferred)
        return map
      })

      const request: ParseRequest = { type: "parse", id, lines }
      w.postMessage(request)

      const result = yield* Deferred.await(deferred).pipe(
        Effect.timeout("5 seconds"),
        Effect.catchTag("TimeoutException", () =>
          Effect.fail(new Error("Worker timeout"))
        )
      )

      return result
    })

  const sendBatchRequest = (
    chunk: string
  ): Effect.Effect<JsonPatch[], Error> =>
    Effect.gen(function* () {
      const w = yield* getWorker
      const id = yield* Ref.updateAndGet(idRef, (n) => n + 1)
      const deferred = yield* Deferred.make<JsonPatch[], Error>()

      yield* Ref.update(pendingRef, (map) => {
        map.set(id, deferred)
        return map
      })

      const request: ParseBatchRequest = { type: "parseBatch", id, chunk }
      w.postMessage(request)

      const result = yield* Deferred.await(deferred).pipe(
        Effect.timeout("5 seconds"),
        Effect.catchTag("TimeoutException", () =>
          Effect.fail(new Error("Worker timeout"))
        )
      )

      return result
    })

  const parseLines = (lines: string[]): Effect.Effect<JsonPatch[], Error> =>
    sendParseRequest(lines)

  const parseChunk = (chunk: string): Effect.Effect<JsonPatch[], Error> =>
    sendBatchRequest(chunk)

  const parseStream = (
    chunks: Stream.Stream<string, Error>
  ): Stream.Stream<JsonPatch, Error> =>
    Stream.flatMap(chunks, (chunk) =>
      Stream.fromEffect(parseChunk(chunk)).pipe(
        Stream.flatMap((patches) => Stream.fromIterable(patches))
      )
    )

  const terminate = (): Effect.Effect<void> =>
    Effect.sync(() => {
      if (worker) {
        worker.terminate()
        worker = null
      }
    })

  return {
    parseLines,
    parseChunk,
    parseStream,
    terminate,
  } satisfies ParseWorkerService
})

// =============================================================================
// Layer
// =============================================================================

export const ParseWorkerLive = Layer.scoped(
  ParseWorker,
  Effect.gen(function* () {
    const service = yield* makeParseWorker
    yield* Effect.addFinalizer(() => service.terminate())
    return service
  })
)

// =============================================================================
// Fallback (no worker, main thread)
// =============================================================================

/**
 * Fallback implementation that runs on main thread.
 * Useful for environments without worker support or for comparison benchmarks.
 */
export const makeParseWorkerFallback = Effect.gen(function* () {
  // Import schema decoder dynamically to avoid circular deps
  const { decodeJsonPatchSync } = yield* Effect.promise(() =>
    import("../core/schemas").then((m) => ({
      decodeJsonPatchSync: m.decodeJsonPatchSync,
    }))
  )

  const parseLine = (line: string): JsonPatch | null => {
    let trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("//")) {
      return null
    }

    if (trimmed.startsWith("data:")) {
      trimmed = trimmed.slice(5).trim()
      if (!trimmed) {
        return null
      }
    }

    try {
      const raw = JSON.parse(trimmed)
      return decodeJsonPatchSync(raw)
    } catch {
      return null
    }
  }

  const parseLines = (lines: string[]): Effect.Effect<JsonPatch[], Error> =>
    Effect.sync(() => {
      const patches: JsonPatch[] = []
      for (const line of lines) {
        const patch = parseLine(line)
        if (patch) patches.push(patch)
      }
      return patches
    })

  const parseChunk = (chunk: string): Effect.Effect<JsonPatch[], Error> =>
    Effect.sync(() => {
      const lines = chunk.split("\n").filter((l) => l.trim())
      const patches: JsonPatch[] = []
      for (const line of lines) {
        const patch = parseLine(line)
        if (patch) patches.push(patch)
      }
      return patches
    })

  const parseStream = (
    chunks: Stream.Stream<string, Error>
  ): Stream.Stream<JsonPatch, Error> =>
    Stream.flatMap(chunks, (chunk) =>
      Stream.fromEffect(parseChunk(chunk)).pipe(
        Stream.flatMap((patches) => Stream.fromIterable(patches))
      )
    )

  const terminate = (): Effect.Effect<void> => Effect.void

  return {
    parseLines,
    parseChunk,
    parseStream,
    terminate,
  } satisfies ParseWorkerService
})

export const ParseWorkerFallback = Layer.effect(ParseWorker, makeParseWorkerFallback)

// =============================================================================
// Auto-selecting Layer
// =============================================================================

/**
 * Auto-selects worker or fallback based on environment.
 * Uses worker in browser, fallback in Node/Bun.
 */
export const ParseWorkerAuto = Layer.effect(
  ParseWorker,
  Effect.gen(function* () {
    if (typeof window !== "undefined" && typeof Worker !== "undefined") {
      return yield* makeParseWorker
    }
    return yield* makeParseWorkerFallback
  })
)
