#!/usr/bin/env bun
/**
 * Minimal streaming test client - bypasses React to isolate streaming issues.
 *
 * Tests the /ui-generate endpoint directly with Effect Stream processing.
 * Run with: bun run scripts/test-streaming-client.ts
 */

import { Effect, Stream, pipe, Option } from "effect"
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

  // Handle SSE format: "data: <json>"
  if (trimmed.startsWith("data:")) {
    trimmed = trimmed.slice(5).trim()
    if (!trimmed) {
      return Option.none()
    }
  }

  try {
    const raw = JSON.parse(trimmed)
    const patch = decodeJsonPatchSync(raw)
    return Option.some(patch)
  } catch {
    return Option.none()
  }
}

// Simple streaming fetch using Effect
const streamFromFetch = (
  url: string,
  body: unknown
): Stream.Stream<JsonPatch, Error> =>
  Stream.asyncPush<JsonPatch, Error>((emit) =>
    Effect.gen(function* () {
      yield* Effect.log("[TEST] Starting fetch...")

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

      yield* Effect.log(`[TEST] Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`)

      const reader = response.body?.getReader()
      if (!reader) {
        return yield* Effect.fail(new Error("No response body"))
      }

      const decoder = new TextDecoder()
      let buffer = ""
      let chunkCount = 0

      while (true) {
        const startTime = Date.now()
        const { done, value } = yield* Effect.tryPromise({
          try: () => reader.read(),
          catch: (e) => e instanceof Error ? e : new Error(String(e))
        })
        const readTime = Date.now() - startTime

        if (done) {
          yield* Effect.log("[TEST] Stream done")
          break
        }

        chunkCount++
        const chunk = decoder.decode(value, { stream: true })
        yield* Effect.log(`[TEST] CHUNK #${chunkCount} (${readTime}ms wait, ${chunk.length} bytes): "${chunk.slice(0, 60).replace(/\n/g, '\\n')}..."`)

        buffer += chunk

        // Process complete lines
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          const maybePatch = parsePatchLine(line)
          if (Option.isSome(maybePatch)) {
            yield* Effect.log(`[TEST] EMIT: ${maybePatch.value.path}`)
            emit.single(maybePatch.value)
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const maybePatch = parsePatchLine(buffer)
        if (Option.isSome(maybePatch)) {
          yield* Effect.log(`[TEST] EMIT (final): ${maybePatch.value.path}`)
          emit.single(maybePatch.value)
        }
      }

      yield* Effect.log("[TEST] Complete")
      emit.end()
    })
  , { bufferSize: "unbounded" })

// Main test
const main = Effect.gen(function* () {
  yield* Effect.log("=== Streaming Test Client ===")
  yield* Effect.log("Testing /ui-generate endpoint with Effect Stream...")
  yield* Effect.log("")

  const url = "http://localhost:7682/ui-generate"
  const body = { prompt: "Create a simple hello card" }

  let patchCount = 0
  const startTime = Date.now()

  yield* pipe(
    streamFromFetch(url, body),
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
  yield* Effect.log(`Avg time between patches: ${patchCount > 0 ? Math.round(totalTime / patchCount) : 0}ms`)
})

Effect.runPromise(main).catch(console.error)
