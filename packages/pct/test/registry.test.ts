/**
 * Registry service hierarchy — end-to-end test.
 *
 * Exercises the full event-sourced registry shape:
 *   1. Layer composition: Registry.layerMemory provides Registry +
 *      EventLog.EventLog + EventLog.Identity all in one shot.
 *   2. Write path: publishers `yield* EventLog.EventLog` and call
 *      `log.write({ schema, event, payload })`.
 *   3. Read path: consumers `yield* Registry` and call `getSchema`,
 *      `listOperations`, etc.
 *   4. State coherence: events written → handler folds state → reads
 *      see the new state.
 *
 * @module @tmnl/pct/test/registry
 */

import { describe, expect, it } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as Schema from "effect-v4/Schema"
import * as SchemaRepresentation from "effect-v4/SchemaRepresentation"
import * as EventLog from "effect-v4/unstable/eventlog/EventLog"

import { Registry } from "../src/registry/Registry.js"
import { layerMemory } from "../src/registry/Memory.js"
import { RegistryGroup } from "../src/registry/RegistryEvents.js"

// A real Effect.Schema with brand + refinement — what registries store.
const OrderId = Schema.String.check(
  Schema.isMinLength(4),
  Schema.isPattern(/^ord_[a-z0-9]+$/),
).pipe(Schema.brand("OrderId"))

const Order = Schema.Struct({
  id: OrderId,
  total: Schema.Number.check(Schema.isGreaterThan(0)),
  currency: Schema.Literals(["USD", "EUR", "GBP"]),
})

const orderRepresentation = SchemaRepresentation.fromAST(Order.ast)
const orderDocumentJson = Schema.encodeUnknownSync(
  SchemaRepresentation.DocumentFromJson,
)(orderRepresentation)

const schema = EventLog.schema(RegistryGroup)

const TEST_NODE_ID = "node-test-001"

describe("Registry service hierarchy", () => {
  describe("write → fold → read coherence", () => {
    it("schemas registered via EventLog.write are visible through Registry.getSchema", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const log = yield* EventLog.EventLog
          const registry = yield* Registry
          // Write a SchemaRegistered event
          yield* log.write({
            schema,
            event: "SchemaRegistered",
            payload: {
              schemaId: "orders/Order",
              version: "1.0.0",
              schemaDocument: orderDocumentJson,
              registeredAt: 1700000000000,
              originNodeId: TEST_NODE_ID,
            },
          })
          // Read it back via the Registry service
          const entry = yield* registry.getSchema("orders/Order@1.0.0")
          return entry
        }).pipe(Effect.provide(layerMemory)),
      )
      expect(result).toBeDefined()
      expect(result?.schemaId).toBe("orders/Order")
      expect(result?.version).toBe("1.0.0")
      expect(result?.deprecated).toBeNull()
      expect(result?.originNodeId).toBe(TEST_NODE_ID)
    })

    it("listSchemas filters out deprecated by default", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const log = yield* EventLog.EventLog
          const registry = yield* Registry
          // Two versions of the same schema
          yield* log.write({
            schema,
            event: "SchemaRegistered",
            payload: {
              schemaId: "orders/Order",
              version: "1.0.0",
              schemaDocument: orderDocumentJson,
              registeredAt: 1700000000000,
              originNodeId: TEST_NODE_ID,
            },
          })
          yield* log.write({
            schema,
            event: "SchemaRegistered",
            payload: {
              schemaId: "orders/Order",
              version: "2.0.0",
              schemaDocument: orderDocumentJson,
              registeredAt: 1700001000000,
              originNodeId: TEST_NODE_ID,
            },
          })
          // Deprecate v1
          yield* log.write({
            schema,
            event: "SchemaDeprecated",
            payload: {
              schemaId: "orders/Order",
              version: "1.0.0",
              successor: "2.0.0",
              deprecatedAt: 1700002000000,
              reason: "obsolete",
              originNodeId: TEST_NODE_ID,
            },
          })
          // Default filter excludes deprecated
          const live = yield* registry.listSchemas()
          // Explicit include returns both
          const all = yield* registry.listSchemas({ includeDeprecated: true })
          return { live, all }
        }).pipe(Effect.provide(layerMemory)),
      )
      expect(result.live.length).toBe(1)
      expect(result.live[0]?.version).toBe("2.0.0")
      expect(result.all.length).toBe(2)
    })

    it("operation registration ties name+version to schema-ids", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const log = yield* EventLog.EventLog
          const registry = yield* Registry
          // Register the input/output schemas
          yield* log.write({
            schema,
            event: "SchemaRegistered",
            payload: {
              schemaId: "orders/CreateOrderInput",
              version: "1.0.0",
              schemaDocument: orderDocumentJson,
              registeredAt: 1,
              originNodeId: TEST_NODE_ID,
            },
          })
          yield* log.write({
            schema,
            event: "SchemaRegistered",
            payload: {
              schemaId: "orders/Order",
              version: "1.0.0",
              schemaDocument: orderDocumentJson,
              registeredAt: 2,
              originNodeId: TEST_NODE_ID,
            },
          })
          // Register the operation
          yield* log.write({
            schema,
            event: "OperationRegistered",
            payload: {
              name: "orders.create",
              version: "1.0.0",
              kind: "mutation",
              inputSchemaId: "orders/CreateOrderInput@1.0.0",
              outputSchemaId: "orders/Order@1.0.0",
              errorSchemaIds: [],
              registeredAt: 3,
              originNodeId: TEST_NODE_ID,
            },
          })
          const op = yield* registry.getOperation("orders.create@1.0.0")
          return op
        }).pipe(Effect.provide(layerMemory)),
      )
      expect(result).toBeDefined()
      expect(result?.kind).toBe("mutation")
      expect(result?.inputSchemaId).toBe("orders/CreateOrderInput@1.0.0")
      expect(result?.outputSchemaId).toBe("orders/Order@1.0.0")
    })

    it("revision is monotonic across writes", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const log = yield* EventLog.EventLog
          const registry = yield* Registry
          const before = yield* registry.revision
          yield* log.write({
            schema,
            event: "SchemaRegistered",
            payload: {
              schemaId: "x/A",
              version: "1.0.0",
              schemaDocument: orderDocumentJson,
              registeredAt: 1,
              originNodeId: TEST_NODE_ID,
            },
          })
          const after1 = yield* registry.revision
          yield* log.write({
            schema,
            event: "SchemaRegistered",
            payload: {
              schemaId: "x/B",
              version: "1.0.0",
              schemaDocument: orderDocumentJson,
              registeredAt: 2,
              originNodeId: TEST_NODE_ID,
            },
          })
          const after2 = yield* registry.revision
          return { before, after1, after2 }
        }).pipe(Effect.provide(layerMemory)),
      )
      expect(result.before).toBe(0)
      expect(result.after1).toBe(1)
      expect(result.after2).toBe(2)
    })

    it("deltaSince returns applied changelog entries in revision order", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const log = yield* EventLog.EventLog
          const registry = yield* Registry
          yield* log.write({
            schema,
            event: "SchemaRegistered",
            payload: {
              schemaId: "delta/A",
              version: "1.0.0",
              schemaDocument: orderDocumentJson,
              registeredAt: 1,
              originNodeId: TEST_NODE_ID,
            },
          })
          yield* log.write({
            schema,
            event: "SchemaRegistered",
            payload: {
              schemaId: "delta/B",
              version: "1.0.0",
              schemaDocument: orderDocumentJson,
              registeredAt: 2,
              originNodeId: TEST_NODE_ID,
            },
          })
          const all = yield* registry.deltaSince(0)
          const afterFirst = yield* registry.deltaSince(1)
          const afterCurrent = yield* registry.deltaSince(2)
          return { all, afterFirst, afterCurrent }
        }).pipe(Effect.provide(layerMemory)),
      )
      expect(result.all.map((change) => change.revision)).toEqual([1, 2])
      expect(result.all.map((change) => change._tag)).toEqual([
        "DeltaSchemaRegistered",
        "DeltaSchemaRegistered",
      ])
      expect(result.afterFirst.map((change) => change.revision)).toEqual([2])
      expect(result.afterCurrent).toHaveLength(0)
    })
  })
})
