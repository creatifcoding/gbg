import { describe, it, expect } from "vitest"
import * as Effect from "effect/Effect"
import * as StreamId from "../../src/contracts/StreamId.js"

describe("contracts/StreamId", () => {
  describe("trust (hot path)", () => {
    it("type-casts any string", () => {
      const id = StreamId.trust("my-stream")
      expect(id).toBe("my-stream")
    })
  })

  describe("parse (Effect.fn)", () => {
    it("accepts valid simple ids", async () => {
      const r = await Effect.runPromise(Effect.exit(StreamId.parse("my-stream")))
      expect(r._tag).toBe("Success")
    })

    it("accepts namespaced ids with slashes and colons", async () => {
      const r = await Effect.runPromise(
        Effect.exit(StreamId.parse("tenant:account/stream-name")),
      )
      expect(r._tag).toBe("Success")
    })

    it("rejects empty string", async () => {
      const r = await Effect.runPromise(Effect.exit(StreamId.parse("")))
      expect(r._tag).toBe("Failure")
      if (r._tag === "Failure") {
        expect(JSON.stringify(r.cause)).toContain("empty")
      }
    })

    it("rejects whitespace", async () => {
      const r = await Effect.runPromise(Effect.exit(StreamId.parse("my stream")))
      expect(r._tag).toBe("Failure")
    })

    it("rejects query-string characters", async () => {
      const r1 = await Effect.runPromise(Effect.exit(StreamId.parse("foo?bar")))
      const r2 = await Effect.runPromise(Effect.exit(StreamId.parse("foo#bar")))
      const r3 = await Effect.runPromise(Effect.exit(StreamId.parse("foo&bar=1")))
      expect(r1._tag).toBe("Failure")
      expect(r2._tag).toBe("Failure")
      expect(r3._tag).toBe("Failure")
    })

    it("rejects strings exceeding MAX_LENGTH", async () => {
      const tooLong = "a".repeat(StreamId.MAX_LENGTH + 1)
      const r = await Effect.runPromise(Effect.exit(StreamId.parse(tooLong)))
      expect(r._tag).toBe("Failure")
      if (r._tag === "Failure") {
        expect(JSON.stringify(r.cause)).toContain("exceeds-max-length")
      }
    })
  })

  describe("decode (Schema validation)", () => {
    it("decodes valid ids", async () => {
      const r = await Effect.runPromise(Effect.exit(StreamId.decode("my-stream")))
      expect(r._tag).toBe("Success")
    })

    it("rejects non-string input", async () => {
      const r = await Effect.runPromise(Effect.exit(StreamId.decode(42)))
      expect(r._tag).toBe("Failure")
    })

    it("rejects empty string at schema level (isMinLength check)", async () => {
      const r = await Effect.runPromise(Effect.exit(StreamId.decode("")))
      expect(r._tag).toBe("Failure")
    })

    it("rejects forbidden characters at schema level (isPattern check)", async () => {
      const r = await Effect.runPromise(Effect.exit(StreamId.decode("foo bar")))
      expect(r._tag).toBe("Failure")
    })
  })

  describe("isStreamIdLike", () => {
    it("accepts valid ids", () => {
      expect(StreamId.isStreamIdLike("my-stream")).toBe(true)
      expect(StreamId.isStreamIdLike("a/b/c")).toBe(true)
    })
    it("rejects non-strings", () => {
      expect(StreamId.isStreamIdLike(42)).toBe(false)
      expect(StreamId.isStreamIdLike(null)).toBe(false)
      expect(StreamId.isStreamIdLike(undefined)).toBe(false)
    })
    it("rejects malformed strings", () => {
      expect(StreamId.isStreamIdLike("")).toBe(false)
      expect(StreamId.isStreamIdLike("with space")).toBe(false)
      expect(StreamId.isStreamIdLike("question?")).toBe(false)
    })
  })
})
