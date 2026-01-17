/**
 * Parse Worker Tests
 *
 * Tests the ParseWorker service using the Fallback layer
 * (actual web workers don't run in Node/Bun test environment).
 *
 * @module json-render/workers/__tests__/parse
 */

import { describe, it, expect } from "vitest"
import { Effect, Stream } from "effect"
import {
  ParseWorker,
  ParseWorkerFallback,
  makeParseWorkerFallback,
} from "../worker-api"

// =============================================================================
// Test Data
// =============================================================================

const validPatches = [
  '{"op":"add","path":"/root","value":{"type":"Box"}}',
  '{"op":"replace","path":"/root/props/color","value":"red"}',
  '{"op":"set","path":"/elements/item-1","value":{"key":"item-1","type":"Text"}}',
  '{"op":"remove","path":"/elements/old-item"}',
]

const sseFormatPatches = [
  'data: {"op":"add","path":"/a","value":1}',
  'data:{"op":"replace","path":"/b","value":2}', // no space after colon
  'data:   {"op":"set","path":"/c","value":3}', // extra spaces
]

const mixedContent = [
  '{"op":"add","path":"/valid","value":true}',
  "// This is a comment",
  "",
  "   ", // whitespace only
  '{"op":"replace","path":"/also-valid","value":false}',
  "not valid json",
  '{"missing":"op field"}', // invalid schema
]

// =============================================================================
// Test Suite
// =============================================================================

describe("ParseWorker", () => {
  describe("parseLines", () => {
    it("should parse valid NDJSON lines", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* ParseWorker
          return yield* worker.parseLines(validPatches)
        }).pipe(Effect.provide(ParseWorkerFallback))
      )

      expect(result).toHaveLength(4)
      expect(result[0]).toMatchObject({ op: "add", path: "/root" })
      expect(result[1]).toMatchObject({ op: "replace", path: "/root/props/color" })
      expect(result[2]).toMatchObject({ op: "set", path: "/elements/item-1" })
      expect(result[3]).toMatchObject({ op: "remove", path: "/elements/old-item" })
    })

    it("should handle SSE format (data: prefix)", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* ParseWorker
          return yield* worker.parseLines(sseFormatPatches)
        }).pipe(Effect.provide(ParseWorkerFallback))
      )

      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({ op: "add", path: "/a", value: 1 })
      expect(result[1]).toMatchObject({ op: "replace", path: "/b", value: 2 })
      expect(result[2]).toMatchObject({ op: "set", path: "/c", value: 3 })
    })

    it("should skip comments and empty lines", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* ParseWorker
          return yield* worker.parseLines(mixedContent)
        }).pipe(Effect.provide(ParseWorkerFallback))
      )

      // Only the 2 valid patches should be parsed
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({ op: "add", path: "/valid" })
      expect(result[1]).toMatchObject({ op: "replace", path: "/also-valid" })
    })

    it("should return empty array for all invalid input", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* ParseWorker
          return yield* worker.parseLines([
            "// comment",
            "",
            "not json",
            '{"no":"op"}',
          ])
        }).pipe(Effect.provide(ParseWorkerFallback))
      )

      expect(result).toHaveLength(0)
    })
  })

  describe("parseChunk", () => {
    it("should parse a raw chunk with newlines", async () => {
      const chunk = validPatches.join("\n")

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* ParseWorker
          return yield* worker.parseChunk(chunk)
        }).pipe(Effect.provide(ParseWorkerFallback))
      )

      expect(result).toHaveLength(4)
      expect(result[0]).toMatchObject({ op: "add" })
      expect(result[3]).toMatchObject({ op: "remove" })
    })

    it("should handle mixed valid/invalid content", async () => {
      const chunk = mixedContent.join("\n")

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* ParseWorker
          return yield* worker.parseChunk(chunk)
        }).pipe(Effect.provide(ParseWorkerFallback))
      )

      // Only valid patches
      expect(result).toHaveLength(2)
    })

    it("should handle CRLF line endings", async () => {
      const chunk = validPatches.slice(0, 2).join("\r\n")

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* ParseWorker
          return yield* worker.parseChunk(chunk)
        }).pipe(Effect.provide(ParseWorkerFallback))
      )

      // Note: split("\n") will leave \r in strings, but JSON.parse handles it
      // This test documents current behavior
      expect(result.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe("parseStream", () => {
    it("should stream patches from chunks", async () => {
      const chunks = Stream.fromIterable([
        '{"op":"add","path":"/a","value":1}',
        '{"op":"add","path":"/b","value":2}\n{"op":"add","path":"/c","value":3}',
      ])

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* ParseWorker
          return yield* Stream.runCollect(worker.parseStream(chunks))
        }).pipe(Effect.provide(ParseWorkerFallback))
      )

      const patches = Array.from(result)
      expect(patches).toHaveLength(3)
      expect(patches[0]).toMatchObject({ path: "/a" })
      expect(patches[1]).toMatchObject({ path: "/b" })
      expect(patches[2]).toMatchObject({ path: "/c" })
    })

    it("should flatten patches from multiple chunks", async () => {
      const chunks = Stream.fromIterable(
        validPatches.map((p) => p) // Each line as separate chunk
      )

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* ParseWorker
          return yield* Stream.runCollect(worker.parseStream(chunks))
        }).pipe(Effect.provide(ParseWorkerFallback))
      )

      expect(Array.from(result)).toHaveLength(4)
    })
  })

  describe("terminate", () => {
    it("should be a no-op for fallback (no worker to terminate)", async () => {
      // Just verify it doesn't throw
      await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* ParseWorker
          yield* worker.terminate()
        }).pipe(Effect.provide(ParseWorkerFallback))
      )
    })
  })

  describe("makeParseWorkerFallback (raw)", () => {
    it("should create service directly without Layer", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* makeParseWorkerFallback
          return yield* service.parseLines(['{"op":"add","path":"/x","value":null}'])
        })
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ op: "add", path: "/x", value: null })
    })
  })
})

describe("JsonPatch Schema Validation", () => {
  it("should require op field", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const worker = yield* ParseWorker
        return yield* worker.parseLines(['{"path":"/x","value":1}'])
      }).pipe(Effect.provide(ParseWorkerFallback))
    )

    expect(result).toHaveLength(0) // Invalid, filtered out
  })

  it("should require path field", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const worker = yield* ParseWorker
        return yield* worker.parseLines(['{"op":"add","value":1}'])
      }).pipe(Effect.provide(ParseWorkerFallback))
    )

    expect(result).toHaveLength(0)
  })

  it("should accept all valid op types", async () => {
    const ops = ["add", "remove", "replace", "set"]
    const lines = ops.map((op) => `{"op":"${op}","path":"/test"}`)

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const worker = yield* ParseWorker
        return yield* worker.parseLines(lines)
      }).pipe(Effect.provide(ParseWorkerFallback))
    )

    expect(result).toHaveLength(4)
    expect(result.map((p) => p.op)).toEqual(ops)
  })

  it("should reject invalid op types", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const worker = yield* ParseWorker
        return yield* worker.parseLines(['{"op":"invalid","path":"/test"}'])
      }).pipe(Effect.provide(ParseWorkerFallback))
    )

    expect(result).toHaveLength(0)
  })

  it("should allow optional value field", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const worker = yield* ParseWorker
        return yield* worker.parseLines([
          '{"op":"remove","path":"/test"}', // No value
          '{"op":"add","path":"/test","value":null}', // Explicit null
          '{"op":"add","path":"/test","value":{"nested":"object"}}',
        ])
      }).pipe(Effect.provide(ParseWorkerFallback))
    )

    expect(result).toHaveLength(3)
    expect(result[0].value).toBeUndefined()
    expect(result[1].value).toBeNull()
    expect(result[2].value).toEqual({ nested: "object" })
  })
})
