import { describe, it, expect } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as Result from "effect-v4/Result"
import * as Offset from "../../src/contracts/Offset.js"

describe("contracts/Offset", () => {
  describe("trust (hot path)", () => {
    it("type-casts any string with zero validation", () => {
      const o = Offset.trust("01_100")
      expect(o).toBe("01_100")
      // Brand is type-only; runtime is just the string.
      expect(typeof o).toBe("string")
    })

    it("trusts the empty string (no defensive check)", () => {
      // trust() is the contract: caller asserts validity. No runtime check.
      const o = Offset.trust("")
      expect(o).toBe("")
    })

    it("trusts sentinel-shaped strings (no defensive check)", () => {
      // trust() is willing to label "-1" as an Offset — caller's responsibility.
      const o = Offset.trust("-1")
      expect(o).toBe("-1")
    })
  })

  describe("parse (Effect.fn)", () => {
    it("succeeds for normal offset strings", async () => {
      const r = await Effect.runPromise(Effect.exit(Offset.parse("01_100")))
      expect(r._tag).toBe("Success")
    })

    it("fails with InvalidOffsetError on empty string", async () => {
      const r = await Effect.runPromise(Effect.exit(Offset.parse("")))
      expect(r._tag).toBe("Failure")
      if (r._tag === "Failure") {
        const failure = r.cause
        // The failure carries our domain error
        expect(JSON.stringify(failure)).toContain("InvalidOffsetError")
        expect(JSON.stringify(failure)).toContain("empty")
      }
    })

    it("fails with InvalidOffsetError on sentinel '-1'", async () => {
      const r = await Effect.runPromise(Effect.exit(Offset.parse("-1")))
      expect(r._tag).toBe("Failure")
      if (r._tag === "Failure") {
        expect(JSON.stringify(r.cause)).toContain("sentinel-not-offset")
      }
    })

    it("fails with InvalidOffsetError on sentinel 'now'", async () => {
      const r = await Effect.runPromise(Effect.exit(Offset.parse("now")))
      expect(r._tag).toBe("Failure")
    })
  })

  describe("decode (Schema validation)", () => {
    it("decodes a valid string", async () => {
      const r = await Effect.runPromise(Effect.exit(Offset.decode("01_100")))
      expect(r._tag).toBe("Success")
    })

    it("rejects non-string input", async () => {
      const r = await Effect.runPromise(Effect.exit(Offset.decode(42)))
      expect(r._tag).toBe("Failure")
    })

    it("accepts the empty string at the schema level (brand has no length filter)", async () => {
      // decode() runs the bare branded Schema.String — does NOT defensively
      // reject empty/sentinel. Use parse() for that.
      const r = await Effect.runPromise(Effect.exit(Offset.decode("")))
      expect(r._tag).toBe("Success")
    })
  })

  describe("sentinel guards", () => {
    it("isSentinel recognizes '-1'", () => {
      expect(Offset.isSentinel("-1")).toBe(true)
    })
    it("isSentinel recognizes 'now'", () => {
      expect(Offset.isSentinel("now")).toBe(true)
    })
    it("isSentinel rejects normal offset strings", () => {
      expect(Offset.isSentinel("01_100")).toBe(false)
      expect(Offset.isSentinel("")).toBe(false)
      expect(Offset.isSentinel("0")).toBe(false)
    })

    it("constants beginning='-1' and now='now'", () => {
      expect(Offset.beginning).toBe("-1")
      expect(Offset.now).toBe("now")
    })
  })

  describe("lexicographic order", () => {
    const a = Offset.trust("01_100")
    const b = Offset.trust("01_200")
    const c = Offset.trust("02_000")

    it("order returns -1 / 0 / 1", () => {
      expect(Offset.order(a, b)).toBe(-1)
      expect(Offset.order(b, a)).toBe(1)
      expect(Offset.order(a, a)).toBe(0)
    })

    it("isLessThan", () => {
      expect(Offset.isLessThan(a, b)).toBe(true)
      expect(Offset.isLessThan(b, a)).toBe(false)
      expect(Offset.isLessThan(a, a)).toBe(false)
    })

    it("isGreaterThan", () => {
      expect(Offset.isGreaterThan(b, a)).toBe(true)
      expect(Offset.isGreaterThan(a, b)).toBe(false)
    })

    it("isLessThanOrEqualTo / isGreaterThanOrEqualTo", () => {
      expect(Offset.isLessThanOrEqualTo(a, a)).toBe(true)
      expect(Offset.isLessThanOrEqualTo(a, b)).toBe(true)
      expect(Offset.isGreaterThanOrEqualTo(a, a)).toBe(true)
      expect(Offset.isGreaterThanOrEqualTo(b, a)).toBe(true)
    })

    it("max picks the lex-greater offset", () => {
      expect(Offset.max(a, b)).toBe(b)
      expect(Offset.max(c, b)).toBe(c)
    })

    it("min picks the lex-lesser offset", () => {
      expect(Offset.min(a, b)).toBe(a)
      expect(Offset.min(c, b)).toBe(b)
    })

    it("equals is string identity", () => {
      const aDup = Offset.trust("01_100")
      expect(Offset.equals(a, aDup)).toBe(true)
      expect(Offset.equals(a, b)).toBe(false)
    })
  })

  describe("hot path is genuinely zero-cost", () => {
    it("trust is a no-op cast (1M iterations under threshold)", () => {
      // Sanity: trust must be type-cast only. 1M iterations should complete
      // in well under 50ms on any reasonable machine.
      const start = performance.now()
      let last: Offset.Offset = Offset.trust("init")
      for (let i = 0; i < 1_000_000; i++) {
        last = Offset.trust("01_100")
      }
      const elapsed = performance.now() - start
      expect(last).toBe("01_100")
      expect(elapsed).toBeLessThan(100) // Generous; usually <10ms.
    })
  })
})
