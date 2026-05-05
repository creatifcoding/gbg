/**
 * Server tests — exercises the PCT HTTP wire surface end-to-end.
 *
 * Uses `HttpRouter.toWebHandler` to lift the `Routes` layer to a
 * `(request: Request) => Promise<Response>` handler. Tests then issue
 * standard fetch-style Requests and assert on responses.
 *
 * Properties verified:
 *   - GET /capabilities returns the encoded Manifest with _tag
 *   - GET /schemas/:id round-trips a registered schema
 *   - POST /publish accepts a schema document, registers it via Notary
 *   - 404 for unknown schemas
 *   - 400 for malformed publish bodies
 *   - The whole flow exercises Pact.Identity → Notary → Registry → wire
 */

import { describe, expect, it } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Schema from "effect-v4/Schema"
import * as SchemaRepresentation from "effect-v4/SchemaRepresentation"
import * as EventJournal from "effect-v4/unstable/eventlog/EventJournal"
import * as HttpRouter from "effect-v4/unstable/http/HttpRouter"

import * as IdentityLayers from "../src/identity/Layers.js"
import * as NotaryDefault from "../src/notary/Default.js"
import * as RegistryMemory from "../src/registry/Memory.js"
import { Routes } from "../src/server/Routes.js"

// ─── Layer composition ──────────────────────────────────────────────────────

const AppLayer = Routes.pipe(
  Layer.provideMerge(NotaryDefault.Default),
  Layer.provideMerge(RegistryMemory.layer),
  Layer.provideMerge(IdentityLayers.layerEphemeral),
  Layer.provideMerge(EventJournal.layerMemory),
)

// ─── Test fixtures ──────────────────────────────────────────────────────────

const Order = Schema.Struct({
  orderId: Schema.String,
  total: Schema.Number,
})

const orderDocument = SchemaRepresentation.fromAST(Order.ast)
const orderDocumentJson = Schema.encodeUnknownSync(
  SchemaRepresentation.DocumentFromJson,
)(orderDocument)

// ─── Tests ──────────────────────────────────────────────────────────────────

const buildHandler = () =>
  HttpRouter.toWebHandler(AppLayer, { disableLogger: true })

describe("PCT Server", () => {
  it("GET /capabilities returns an encoded Manifest before any publish", async () => {
    const { handler, dispose } = buildHandler()
    try {
      const response = await handler(
        new Request("http://test/capabilities", { method: "GET" }),
      )
      expect(response.status).toBe(200)
      const body = (await response.json()) as Record<string, unknown>
      expect(body._tag).toBe("Manifest")
      expect(body.nodeId).toMatch(/^pct:[0-9a-f]{8}$/)
      expect(body.revision).toBe(0)
      expect(body.schemas).toEqual([])
      expect(body.operations).toEqual([])
    } finally {
      await dispose()
    }
  })

  it("POST /publish + GET /schemas round-trip a registered schema", async () => {
    const { handler, dispose } = buildHandler()
    try {
      // 1. Publish
      const publishResponse = await handler(
        new Request("http://test/publish", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "orders/Order",
            version: "1.0.0",
            schemaDocument: orderDocumentJson,
            description: "A purchase order",
          }),
        }),
      )
      expect(publishResponse.status).toBe(200)
      const published = (await publishResponse.json()) as {
        schemaId: string
        revision: number
        originNodeId: string
      }
      expect(published.schemaId).toBe("orders/Order@1.0.0")
      expect(published.revision).toBeGreaterThan(0)
      expect(published.originNodeId).toMatch(/^pct:[0-9a-f]{8}$/)

      // 2. Fetch
      const schemaUrl =
        "http://test/schemas/" + encodeURIComponent("orders/Order@1.0.0")
      const fetchResponse = await handler(
        new Request(schemaUrl, { method: "GET" }),
      )
      expect(fetchResponse.status).toBe(200)
      const schemaEntry = (await fetchResponse.json()) as {
        schemaId: string
        version: string
        description: string | null
        originNodeId: string
        deprecated: unknown
      }
      expect(schemaEntry.schemaId).toBe("orders/Order")
      expect(schemaEntry.version).toBe("1.0.0")
      expect(schemaEntry.description).toBe("A purchase order")
      expect(schemaEntry.originNodeId).toBe(published.originNodeId)
      expect(schemaEntry.deprecated).toBeNull()
    } finally {
      await dispose()
    }
  })

  it("GET /capabilities reflects published schemas", async () => {
    const { handler, dispose } = buildHandler()
    try {
      // Publish first
      await handler(
        new Request("http://test/publish", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "orders/Order",
            version: "1.0.0",
            schemaDocument: orderDocumentJson,
          }),
        }),
      )

      // Then fetch capabilities
      const response = await handler(
        new Request("http://test/capabilities", { method: "GET" }),
      )
      const body = (await response.json()) as {
        revision: number
        schemas: ReadonlyArray<{ schemaId: string; version: string }>
      }
      expect(body.revision).toBe(1)
      expect(body.schemas).toHaveLength(1)
      expect(body.schemas[0].schemaId).toBe("orders/Order")
      expect(body.schemas[0].version).toBe("1.0.0")
    } finally {
      await dispose()
    }
  })

  it("GET /schemas/:id returns 404 for unknown schemaId", async () => {
    const { handler, dispose } = buildHandler()
    try {
      const response = await handler(
        new Request(
          "http://test/schemas/" + encodeURIComponent("unknown@1.0.0"),
          { method: "GET" },
        ),
      )
      expect(response.status).toBe(404)
      const body = (await response.json()) as { error: { code: string } }
      expect(body.error.code).toBe("PCT_SCHEMA_NOT_FOUND")
    } finally {
      await dispose()
    }
  })

  it("POST /publish returns 400 on malformed body", async () => {
    const { handler, dispose } = buildHandler()
    try {
      const response = await handler(
        new Request("http://test/publish", {
          method: "POST",
          headers: { "content-type": "application/json" },
          // Missing 'name' and 'version' — schema validation fails.
          body: JSON.stringify({ schemaDocument: {} }),
        }),
      )
      expect(response.status).toBe(400)
      const body = (await response.json()) as { error: { code: string } }
      expect(body.error.code).toBe("PCT_SCHEMA_DECODE")
    } finally {
      await dispose()
    }
  })
})
