import { describe, it, expect } from "vitest"
import * as Effect from "effect/Effect"
import * as ContentType from "../../src/contracts/ContentType.js"

describe("contracts/ContentType", () => {
  describe("framingMode (spec-driven)", () => {
    it("application/json → json", () => {
      expect(ContentType.framingMode("application/json")).toBe("json")
    })

    it("application/json with params → json", () => {
      expect(ContentType.framingMode("application/json; charset=utf-8")).toBe(
        "json",
      )
    })

    it("application/<x>+json → json (suffix)", () => {
      expect(ContentType.framingMode("application/ld+json")).toBe("json")
      expect(ContentType.framingMode("application/vnd.api+json")).toBe("json")
    })

    it("text/json → raw (NOT a JSON-framing content type per spec)", () => {
      // Per spec, only application/json and application/*+json are JSON-framed.
      expect(ContentType.framingMode("text/json")).toBe("raw")
    })

    it("application/octet-stream → raw", () => {
      expect(ContentType.framingMode("application/octet-stream")).toBe("raw")
    })

    it("text/plain → raw", () => {
      expect(ContentType.framingMode("text/plain")).toBe("raw")
    })

    it("is case-insensitive on the type/subtype", () => {
      expect(ContentType.framingMode("APPLICATION/JSON")).toBe("json")
      expect(ContentType.framingMode("Application/Json")).toBe("json")
    })
  })

  describe("isJson / isRaw", () => {
    it("isJson is true exactly when framingMode is 'json'", () => {
      expect(ContentType.isJson("application/json")).toBe(true)
      expect(ContentType.isJson("application/ld+json")).toBe(true)
      expect(ContentType.isJson("text/plain")).toBe(false)
      expect(ContentType.isJson("application/octet-stream")).toBe(false)
    })

    it("isRaw is the complement of isJson", () => {
      const samples = [
        "application/json",
        "application/octet-stream",
        "text/plain",
        "application/ld+json",
      ]
      for (const s of samples) {
        expect(ContentType.isJson(s)).toBe(!ContentType.isRaw(s))
      }
    })
  })

  describe("parseContentType (typed-input validation)", () => {
    it("accepts well-formed media types", async () => {
      const r = await Effect.runPromise(
        Effect.exit(ContentType.parseContentType("application/json")),
      )
      expect(r._tag).toBe("Success")
    })

    it("accepts media types with params", async () => {
      const r = await Effect.runPromise(
        Effect.exit(ContentType.parseContentType("application/json; charset=utf-8")),
      )
      expect(r._tag).toBe("Success")
    })

    it("rejects empty string", async () => {
      const r = await Effect.runPromise(
        Effect.exit(ContentType.parseContentType("")),
      )
      expect(r._tag).toBe("Failure")
    })

    it("rejects strings without a slash", async () => {
      const r = await Effect.runPromise(
        Effect.exit(ContentType.parseContentType("not-a-mime-type")),
      )
      expect(r._tag).toBe("Failure")
    })

    it("rejects strings with empty type or subtype", async () => {
      const r1 = await Effect.runPromise(
        Effect.exit(ContentType.parseContentType("/json")),
      )
      const r2 = await Effect.runPromise(
        Effect.exit(ContentType.parseContentType("application/")),
      )
      expect(r1._tag).toBe("Failure")
      expect(r2._tag).toBe("Failure")
    })
  })

  describe("decode (Schema validation)", () => {
    it("decodes any string (brand-only schema)", async () => {
      const r = await Effect.runPromise(
        Effect.exit(ContentType.decode("application/json")),
      )
      expect(r._tag).toBe("Success")
    })

    it("rejects non-string input", async () => {
      const r = await Effect.runPromise(Effect.exit(ContentType.decode(42)))
      expect(r._tag).toBe("Failure")
    })
  })

  describe("constants", () => {
    it("APPLICATION_JSON has framing mode 'json'", () => {
      expect(ContentType.framingMode(ContentType.APPLICATION_JSON)).toBe("json")
    })
    it("APPLICATION_OCTET_STREAM has framing mode 'raw'", () => {
      expect(ContentType.framingMode(ContentType.APPLICATION_OCTET_STREAM)).toBe(
        "raw",
      )
    })
    it("TEXT_PLAIN has framing mode 'raw'", () => {
      expect(ContentType.framingMode(ContentType.TEXT_PLAIN)).toBe("raw")
    })
  })
})
