import { describe, it, expect } from "vitest"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Headers from "../../src/contracts/Headers.js"

/**
 * Test helper: convert a plain `Record<string, string>` into something that
 * implements `HeaderSource` (case-insensitive `.get(name)`).
 */
const headerSource = (record: Record<string, string>): Headers.HeaderSource => {
  const lower = new Map<string, string>()
  for (const [k, v] of Object.entries(record)) lower.set(k.toLowerCase(), v)
  return {
    get: (name: string) => lower.get(name.toLowerCase()) ?? null,
  }
}

describe("contracts/Headers — parsers", () => {
  describe("Stream-Next-Offset (required)", () => {
    it("returns the trusted Offset", async () => {
      const src = headerSource({ "Stream-Next-Offset": "01_100" })
      const r = await Effect.runPromise(Headers.parseStreamNextOffset(src))
      expect(r).toBe("01_100")
    })

    it("fails with InvalidHeaderError when missing", async () => {
      const src = headerSource({})
      const r = await Effect.runPromise(
        Effect.exit(Headers.parseStreamNextOffset(src)),
      )
      expect(r._tag).toBe("Failure")
      if (r._tag === "Failure") {
        expect(JSON.stringify(r.cause)).toContain("Stream-Next-Offset")
        expect(JSON.stringify(r.cause)).toContain("missing")
      }
    })

    it("is case-insensitive on the source side", async () => {
      // HeaderSource implementations are expected to be case-insensitive.
      // Web Headers are; our test helper is.
      const src = headerSource({ "stream-next-offset": "01_100" })
      const r = await Effect.runPromise(Headers.parseStreamNextOffset(src))
      expect(r).toBe("01_100")
    })
  })

  describe("Stream-Next-Offset (optional)", () => {
    it("returns Some when present", async () => {
      const src = headerSource({ "Stream-Next-Offset": "01_100" })
      const r = await Effect.runPromise(Headers.parseStreamNextOffsetOptional(src))
      expect(Option.isSome(r)).toBe(true)
    })
    it("returns None when missing", async () => {
      const src = headerSource({})
      const r = await Effect.runPromise(Headers.parseStreamNextOffsetOptional(src))
      expect(Option.isNone(r)).toBe(true)
    })
  })

  describe("Stream-Up-To-Date", () => {
    it("returns true on literal 'true'", async () => {
      const src = headerSource({ "Stream-Up-To-Date": "true" })
      const r = await Effect.runPromise(Headers.parseStreamUpToDate(src))
      expect(r).toBe(true)
    })
    it("returns true on uppercase TRUE (case-insensitive value)", async () => {
      const src = headerSource({ "Stream-Up-To-Date": "TRUE" })
      const r = await Effect.runPromise(Headers.parseStreamUpToDate(src))
      expect(r).toBe(true)
    })
    it("returns false when missing", async () => {
      const src = headerSource({})
      const r = await Effect.runPromise(Headers.parseStreamUpToDate(src))
      expect(r).toBe(false)
    })
    it("returns false on non-true value", async () => {
      const src = headerSource({ "Stream-Up-To-Date": "false" })
      const r = await Effect.runPromise(Headers.parseStreamUpToDate(src))
      expect(r).toBe(false)
    })
  })

  describe("Stream-Closed", () => {
    it("returns true on 'true'", async () => {
      const src = headerSource({ "Stream-Closed": "true" })
      const r = await Effect.runPromise(Headers.parseStreamClosed(src))
      expect(r).toBe(true)
    })
    it("returns false when missing", async () => {
      const src = headerSource({})
      const r = await Effect.runPromise(Headers.parseStreamClosed(src))
      expect(r).toBe(false)
    })
  })

  describe("Stream-Cursor", () => {
    it("returns Some(value) when present", async () => {
      const src = headerSource({ "Stream-Cursor": "abc-123" })
      const r = await Effect.runPromise(Headers.parseStreamCursor(src))
      expect(Option.isSome(r)).toBe(true)
      if (Option.isSome(r)) expect(r.value).toBe("abc-123")
    })
    it("returns None when missing", async () => {
      const src = headerSource({})
      const r = await Effect.runPromise(Headers.parseStreamCursor(src))
      expect(Option.isNone(r)).toBe(true)
    })
  })

  describe("Producer headers (tuple)", () => {
    it("parses all three", async () => {
      const src = headerSource({
        "Producer-Id": "prod-a",
        "Producer-Epoch": "0",
        "Producer-Seq": "42",
      })
      const r = await Effect.runPromise(Headers.parseProducerHeaders(src))
      expect(Option.isSome(r)).toBe(true)
      if (Option.isSome(r)) {
        expect(r.value.producerId).toBe("prod-a")
        expect(r.value.epoch).toBe(0)
        expect(r.value.seq).toBe(42)
      }
    })

    it("returns None when all three are absent", async () => {
      const src = headerSource({})
      const r = await Effect.runPromise(Headers.parseProducerHeaders(src))
      expect(Option.isNone(r)).toBe(true)
    })

    it("fails on partial tuple (missing one)", async () => {
      const src = headerSource({
        "Producer-Id": "prod-a",
        "Producer-Epoch": "0",
        // Producer-Seq missing
      })
      const r = await Effect.runPromise(
        Effect.exit(Headers.parseProducerHeaders(src)),
      )
      expect(r._tag).toBe("Failure")
      if (r._tag === "Failure") {
        expect(JSON.stringify(r.cause)).toContain("partial-tuple")
      }
    })

    it("fails on malformed epoch", async () => {
      const src = headerSource({
        "Producer-Id": "prod-a",
        "Producer-Epoch": "not-a-number",
        "Producer-Seq": "0",
      })
      const r = await Effect.runPromise(
        Effect.exit(Headers.parseProducerHeaders(src)),
      )
      expect(r._tag).toBe("Failure")
      if (r._tag === "Failure") {
        expect(JSON.stringify(r.cause)).toContain("Producer-Epoch")
      }
    })

    it("fails on negative seq", async () => {
      const src = headerSource({
        "Producer-Id": "prod-a",
        "Producer-Epoch": "0",
        "Producer-Seq": "-1",
      })
      const r = await Effect.runPromise(
        Effect.exit(Headers.parseProducerHeaders(src)),
      )
      expect(r._tag).toBe("Failure")
    })
  })

  describe("Content-Type (raw extract)", () => {
    it("returns Some when present", async () => {
      const src = headerSource({ "Content-Type": "application/json" })
      const r = await Effect.runPromise(Headers.parseContentTypeHeader(src))
      expect(Option.isSome(r)).toBe(true)
    })
    it("returns None when missing", async () => {
      const src = headerSource({})
      const r = await Effect.runPromise(Headers.parseContentTypeHeader(src))
      expect(Option.isNone(r)).toBe(true)
    })
  })
})

describe("contracts/Headers — serializers (roundtrip)", () => {
  it("producerHeaders → parseProducerHeaders roundtrip", async () => {
    const out = Headers.producerHeaders({
      producerId: "prod-a" as any,
      epoch: 5 as any,
      seq: 100 as any,
    })
    expect(out["Producer-Id"]).toBe("prod-a")
    expect(out["Producer-Epoch"]).toBe("5")
    expect(out["Producer-Seq"]).toBe("100")

    const src = headerSource(out)
    const r = await Effect.runPromise(Headers.parseProducerHeaders(src))
    expect(Option.isSome(r)).toBe(true)
    if (Option.isSome(r)) {
      expect(r.value.producerId).toBe("prod-a")
      expect(r.value.epoch).toBe(5)
      expect(r.value.seq).toBe(100)
    }
  })

  it("streamClosedHeader produces { Stream-Closed: 'true' }", () => {
    expect(Headers.streamClosedHeader()).toEqual({ "Stream-Closed": "true" })
  })

  it("streamCursorHeader carries the cursor value", () => {
    expect(Headers.streamCursorHeader("xyz")).toEqual({ "Stream-Cursor": "xyz" })
  })

  it("contentTypeHeader carries the content type", () => {
    expect(Headers.contentTypeHeader("application/json")).toEqual({
      "Content-Type": "application/json",
    })
  })
})

describe("contracts/Headers — constants", () => {
  it("ALL_HEADERS includes the full canonical set", () => {
    expect(Headers.ALL_HEADERS).toContain("Stream-Next-Offset")
    expect(Headers.ALL_HEADERS).toContain("Stream-Up-To-Date")
    expect(Headers.ALL_HEADERS).toContain("Stream-Closed")
    expect(Headers.ALL_HEADERS).toContain("Stream-Cursor")
    expect(Headers.ALL_HEADERS).toContain("Producer-Id")
    expect(Headers.ALL_HEADERS).toContain("Producer-Epoch")
    expect(Headers.ALL_HEADERS).toContain("Producer-Seq")
    expect(Headers.ALL_HEADERS).toContain("Content-Type")
  })
})
