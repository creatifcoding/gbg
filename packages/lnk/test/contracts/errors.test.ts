import { describe, it, expect } from "vitest"
import * as Effect from "effect-v4/Effect"
import {
  InvalidOffsetError,
  InvalidStreamIdError,
  InvalidContentTypeError,
  InvalidHeaderError,
  StaleEpochError,
  SequenceGapError,
  StreamClosedError,
  RetentionDroppedError,
  FetchError,
} from "../../src/contracts/errors.js"

describe("contracts/errors — Schema.TaggedErrorClass", () => {
  it("InvalidOffsetError is yieldable + tagged", async () => {
    const program = Effect.gen(function* () {
      yield* new InvalidOffsetError({ value: "", reason: "empty" })
    })
    const r = await Effect.runPromise(Effect.exit(program))
    expect(r._tag).toBe("Failure")
    if (r._tag === "Failure") {
      expect(JSON.stringify(r.cause)).toContain("InvalidOffsetError")
      expect(JSON.stringify(r.cause)).toContain("empty")
    }
  })

  it("InvalidStreamIdError carries reason", async () => {
    const r = await Effect.runPromise(
      Effect.exit(
        Effect.gen(function* () {
          yield* new InvalidStreamIdError({
            value: "bad id",
            reason: "contains-forbidden-characters",
          })
        }),
      ),
    )
    expect(r._tag).toBe("Failure")
    if (r._tag === "Failure") {
      expect(JSON.stringify(r.cause)).toContain("contains-forbidden-characters")
    }
  })

  it("InvalidContentTypeError instance has correct _tag", () => {
    const e = new InvalidContentTypeError({ value: "x", reason: "missing-slash" })
    expect(e._tag).toBe("InvalidContentTypeError")
    expect(e.value).toBe("x")
  })

  it("InvalidHeaderError supports optional value", () => {
    const e1 = new InvalidHeaderError({ name: "Stream-Next-Offset", reason: "missing" })
    expect(e1._tag).toBe("InvalidHeaderError")
    expect(e1.name).toBe("Stream-Next-Offset")
    expect(e1.value).toBeUndefined()

    const e2 = new InvalidHeaderError({
      name: "Producer-Epoch",
      value: "abc",
      reason: "expected-non-negative-integer",
    })
    expect(e2.value).toBe("abc")
  })

  it("StaleEpochError carries fencing context", () => {
    const e = new StaleEpochError({
      streamId: "my-stream",
      producerId: "prod-a",
      ourEpoch: 0,
      serverEpoch: 1,
    })
    expect(e._tag).toBe("StaleEpochError")
    expect(e.ourEpoch).toBe(0)
    expect(e.serverEpoch).toBe(1)
  })

  it("SequenceGapError carries seq context", () => {
    const e = new SequenceGapError({
      streamId: "my-stream",
      producerId: "prod-a",
      expectedSeq: 5,
      receivedSeq: 7,
    })
    expect(e._tag).toBe("SequenceGapError")
    expect(e.expectedSeq).toBe(5)
    expect(e.receivedSeq).toBe(7)
  })

  it("StreamClosedError lastOffset is optional", () => {
    const e1 = new StreamClosedError({ streamId: "my-stream" })
    expect(e1._tag).toBe("StreamClosedError")
    expect(e1.lastOffset).toBeUndefined()

    const e2 = new StreamClosedError({ streamId: "my-stream", lastOffset: "01_999" })
    expect(e2.lastOffset).toBe("01_999")
  })

  it("RetentionDroppedError carries requested offset", () => {
    const e = new RetentionDroppedError({
      streamId: "my-stream",
      requestedOffset: "00_000",
      oldestAvailableOffset: "01_000",
    })
    expect(e._tag).toBe("RetentionDroppedError")
    expect(e.requestedOffset).toBe("00_000")
    expect(e.oldestAvailableOffset).toBe("01_000")
  })

  it("FetchError supports optional status and cause", () => {
    const e1 = new FetchError({ message: "network down" })
    expect(e1._tag).toBe("FetchError")
    expect(e1.status).toBeUndefined()

    const e2 = new FetchError({
      status: 503,
      message: "service unavailable",
      cause: new Error("ECONNREFUSED"),
    })
    expect(e2.status).toBe(503)
  })

  it("errors discriminate via _tag in Effect.catchTag", async () => {
    const program = Effect.gen(function* () {
      yield* new StreamClosedError({ streamId: "foo" })
      return "unreachable"
    }).pipe(
      Effect.catchTag("StreamClosedError", (e) =>
        Effect.succeed(`closed:${e.streamId}`),
      ),
    )
    const r = await Effect.runPromise(program)
    expect(r).toBe("closed:foo")
  })
})
