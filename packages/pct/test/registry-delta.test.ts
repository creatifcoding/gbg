/**
 * RegistryDelta schema tests.
 */

import { describe, expect, it } from "vitest"
import * as SchemaRepresentation from "effect/SchemaRepresentation"
import * as Schema from "effect/Schema"

import * as Delta from "../src/registry/RegistryDelta.js"

const Order = Schema.Struct({ orderId: Schema.String })
const document = Schema.encodeUnknownSync(SchemaRepresentation.DocumentFromJson)(
  SchemaRepresentation.fromAST(Order.ast),
)

describe("RegistryDelta", () => {
  it("round-trips a schema registration change and preserves event projection", () => {
    const change = Delta.makeSchemaRegistered(1, {
      schemaId: "orders/Order",
      version: "1.0.0",
      schemaDocument: document,
      registeredAt: 123,
      originNodeId: "pct:a",
    })
    const delta = Delta.fromChanges({
      nodeId: "pct:a",
      fromRevision: 0,
      toRevision: 1,
      asOf: "1970-01-01T00:00:00.123Z",
      changes: [change],
    })

    const decoded = Delta.decodeUnsafe(delta)
    expect(decoded._tag).toBe("RegistryDelta")
    expect(decoded.complete).toBe(true)
    expect(decoded.changes).toHaveLength(1)
    expect(decoded.changes[0]._tag).toBe("DeltaSchemaRegistered")
    expect(Delta.toRegistryEvent(decoded.changes[0])).toMatchObject({
      event: "SchemaRegistered",
      payload: { schemaId: "orders/Order", version: "1.0.0" },
    })
  })
})
