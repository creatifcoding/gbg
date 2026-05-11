/**
 * HttpRoutes integration tests — exercises the production Lnk routes
 * Layer end-to-end via `HttpRouter.toWebHandler`.
 *
 * Validates the architectural commitment: Lnk's Layer-shaped routes
 * compose with other route layers on a single HttpRouter. Tests issue
 * fetch-style Requests through the lifted handler.
 *
 * Properties verified:
 *   - PUT creates a stream (201 + Location + content-type echo)
 *   - POST appends bytes (204 / 200 producer-tracked)
 *   - GET returns the appended bytes with Stream-Next-Offset
 *   - 404 for unknown stream on POST
 */

import { describe, expect, it } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as HttpRouter from "effect-v4/unstable/http/HttpRouter"

import { Routes } from "../../../../src/services/wire/http/HttpRoutes.js"
import { InMemoryWire } from "../../../../src/services/wire/in-memory/index.js"

// ─── Test layer: routes + InMemoryWire ──────────────────────────────────────

const AppLayer = Routes.pipe(Layer.provideMerge(InMemoryWire.layer))

const buildHandler = () =>
  HttpRouter.toWebHandler(AppLayer, { disableLogger: true })

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Lnk HttpRoutes", () => {
  it("PUT creates a stream and echoes content-type + Location", async () => {
    const { handler, dispose } = buildHandler()
    try {
      const response = await handler(
        new Request("http://test/streams/orders.events", {
          method: "PUT",
          headers: { "content-type": "application/json" },
        }),
      )
      expect(response.status).toBe(201)
      expect(response.headers.get("content-type")).toBe("application/json")
      expect(response.headers.get("location")).toMatch(
        /\/streams\/orders\.events$/,
      )
    } finally {
      await dispose()
    }
  })

  it("PUT + POST + GET round-trips a payload", async () => {
    const { handler, dispose } = buildHandler()
    try {
      // 1. PUT (create stream)
      const putResponse = await handler(
        new Request("http://test/streams/vitals.hr", {
          method: "PUT",
          headers: { "content-type": "application/json" },
        }),
      )
      expect(putResponse.status).toBe(201)

      // 2. POST (append a JSON message)
      const payload = JSON.stringify({ bpm: 72, deviceId: "dev_1" })
      const postResponse = await handler(
        new Request("http://test/streams/vitals.hr", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
        }),
      )
      // No producer headers → 204 expected per spec
      expect(postResponse.status).toBe(204)
      expect(postResponse.headers.get("stream-next-offset")).toBeTruthy()

      // 3. GET (read from start)
      const getResponse = await handler(
        new Request("http://test/streams/vitals.hr?offset=-1", {
          method: "GET",
        }),
      )
      expect(getResponse.status).toBe(200)
      expect(getResponse.headers.get("stream-next-offset")).toBeTruthy()
      const body = await getResponse.text()
      // Body contains the JSON payload (possibly framed)
      expect(body).toContain("bpm")
      expect(body).toContain("72")
    } finally {
      await dispose()
    }
  })

  it("POST to unknown stream returns 404", async () => {
    const { handler, dispose } = buildHandler()
    try {
      const response = await handler(
        new Request("http://test/streams/never-created", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ x: 1 }),
        }),
      )
      expect(response.status).toBe(404)
    } finally {
      await dispose()
    }
  })

  it("POST with body but no Content-Type returns 400", async () => {
    const { handler, dispose } = buildHandler()
    try {
      // Create the stream first
      await handler(
        new Request("http://test/streams/needs-ct", {
          method: "PUT",
          headers: { "content-type": "application/json" },
        }),
      )
      // POST with bytes body but explicitly NO content-type header.
      // Use Uint8Array so Request constructor doesn't auto-apply text/plain.
      const response = await handler(
        new Request("http://test/streams/needs-ct", {
          method: "POST",
          body: new Uint8Array([1, 2, 3]),
        }),
      )
      expect(response.status).toBe(400)
    } finally {
      await dispose()
    }
  })

  it("GET ?live=long-poll without offset returns 400", async () => {
    const { handler, dispose } = buildHandler()
    try {
      // Create stream
      await handler(
        new Request("http://test/streams/lp-test", {
          method: "PUT",
          headers: { "content-type": "application/json" },
        }),
      )
      // long-poll without offset
      const response = await handler(
        new Request("http://test/streams/lp-test?live=long-poll", {
          method: "GET",
        }),
      )
      expect(response.status).toBe(400)
    } finally {
      await dispose()
    }
  })
})
