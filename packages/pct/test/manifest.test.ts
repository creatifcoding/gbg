/**
 * Manifest tests — exercises the Phase 3.2 surface end-to-end.
 *
 * Coverage:
 *   - fromRegistry uses an atomic snapshot (consistency)
 *   - encode + decode round-trip preserves semantics
 *   - print produces non-empty, structured output
 *   - diffAgainst correctly classifies adds, removes, deprecations
 *   - TaggedClass _tag is preserved through encode/decode
 *   - Federation precedence rule: out-of-order events are skipped
 *
 * @module @tmnl/pct/test/manifest
 */

import { describe, expect, it } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as Schema from "effect-v4/Schema"
import * as SchemaRepresentation from "effect-v4/SchemaRepresentation"
import * as EventLog from "effect-v4/unstable/eventlog/EventLog"

import { Manifest, PeerInfo } from "../src/manifest/Manifest.js"
import { Registry } from "../src/registry/Registry.js"
import { layerMemory } from "../src/registry/Memory.js"
import { RegistryGroup } from "../src/registry/RegistryEvents.js"
import {
  Deprecation,
  OperationEntry,
  SchemaEntry,
  empty,
  onSchemaRegistered,
} from "../src/registry/RegistryState.js"

// A real Effect.Schema for round-trip testing.
const OrderId = Schema.String.check(
  Schema.isMinLength(4),
  Schema.isPattern(/^ord_[a-z0-9]+$/),
).pipe(Schema.brand("OrderId"))
const Order = Schema.Struct({ id: OrderId, total: Schema.Number })
const orderDocJson = Schema.encodeUnknownSync(
  SchemaRepresentation.DocumentFromJson,
)(SchemaRepresentation.fromAST(Order.ast))

const schema = EventLog.schema(RegistryGroup)
const NODE_A = "node-A"
const NODE_B = "node-B"

const seedRegistry = Effect.gen(function* () {
  const log = yield* EventLog.EventLog
  yield* log.write({
    schema,
    event: "SchemaRegistered",
    payload: {
      schemaId: "orders/Order",
      version: "1.0.0",
      schemaDocument: orderDocJson,
      registeredAt: 1700000000000,
      originNodeId: NODE_A,
    },
  })
  yield* log.write({
    schema,
    event: "SchemaRegistered",
    payload: {
      schemaId: "orders/Order",
      version: "2.0.0",
      schemaDocument: orderDocJson,
      registeredAt: 1700001000000,
      originNodeId: NODE_A,
    },
  })
  yield* log.write({
    schema,
    event: "SchemaDeprecated",
    payload: {
      schemaId: "orders/Order",
      version: "1.0.0",
      successor: "2.0.0",
      deprecatedAt: 1700002000000,
      reason: "ergonomics",
      originNodeId: NODE_A,
    },
  })
  yield* log.write({
    schema,
    event: "OperationRegistered",
    payload: {
      name: "orders.create",
      version: "2.0.0",
      kind: "mutation",
      inputSchemaId: "orders/CreateOrderInput@2.0.0",
      outputSchemaId: "orders/Order@2.0.0",
      errorSchemaIds: [],
      registeredAt: 1700001500000,
      originNodeId: NODE_A,
    },
  })
})

describe("Manifest", () => {
  describe("fromRegistry (snapshot consistency)", () => {
    it("reads a coherent snapshot of registry state", async () => {
      const m = await Effect.runPromise(
        Effect.gen(function* () {
          yield* seedRegistry
          return yield* Manifest.fromRegistry({ nodeId: NODE_A })
        }).pipe(Effect.provide(layerMemory)),
      )
      expect(m._tag).toBe("Manifest")
      expect(m.nodeId).toBe(NODE_A)
      // 2 schemas live + 1 deprecated; default includes deprecated
      expect(m.schemas.length).toBe(2)
      expect(m.operations.length).toBe(1)
      expect(m.revision).toBeGreaterThan(0)
      expect(m.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T/) // ISO-8601 prefix
    })

    it("excludeDeprecated filters out deprecated entries", async () => {
      const m = await Effect.runPromise(
        Effect.gen(function* () {
          yield* seedRegistry
          return yield* Manifest.fromRegistry({
            nodeId: NODE_A,
            excludeDeprecated: true,
          })
        }).pipe(Effect.provide(layerMemory)),
      )
      // 2 schemas registered (1.0.0, 2.0.0); 1.0.0 is deprecated.
      // excludeDeprecated → only 2.0.0 remains.
      expect(m.schemas.length).toBe(1)
      expect(m.schemas[0]?.version).toBe("2.0.0")
    })
  })

  describe("encode + decode round-trip", () => {
    it("Manifest survives encode → decode (TaggedClass identity preserved)", async () => {
      const m = await Effect.runPromise(
        Effect.gen(function* () {
          yield* seedRegistry
          return yield* Manifest.fromRegistry({ nodeId: NODE_A })
        }).pipe(Effect.provide(layerMemory)),
      )
      const encoded = await Effect.runPromise(m.encode())
      // Round-trip
      const decoded = await Effect.runPromise(Manifest.decode(encoded))
      expect(decoded).toBeInstanceOf(Manifest)
      expect(decoded._tag).toBe("Manifest")
      expect(decoded.nodeId).toBe(m.nodeId)
      expect(decoded.revision).toBe(m.revision)
      expect(decoded.schemas.length).toBe(m.schemas.length)
      expect(decoded.operations.length).toBe(m.operations.length)
      // _tag preserved on nested entries
      for (const s of decoded.schemas) expect(s._tag).toBe("SchemaEntry")
      for (const o of decoded.operations) expect(o._tag).toBe("OperationEntry")
    })

    it("encodeUnsafe / decodeUnsafe sync variants work", async () => {
      const m = await Effect.runPromise(
        Effect.gen(function* () {
          yield* seedRegistry
          return yield* Manifest.fromRegistry({ nodeId: NODE_A })
        }).pipe(Effect.provide(layerMemory)),
      )
      const encoded = m.encodeUnsafe()
      const decoded = Manifest.decodeUnsafe(encoded)
      expect(decoded).toBeInstanceOf(Manifest)
      expect(decoded.nodeId).toBe(m.nodeId)
    })

    it("decode rejects malformed input via SchemaError", async () => {
      const result = await Effect.runPromiseExit(
        Manifest.decode({ not_a_manifest: true }),
      )
      expect(result._tag).toBe("Failure")
    })
  })

  describe("print", () => {
    it("renders a header + sections with non-empty content", async () => {
      const text = await Effect.runPromise(
        Effect.gen(function* () {
          yield* seedRegistry
          const m = yield* Manifest.fromRegistry({
            nodeId: NODE_A,
            nodeUrl: "https://example.com",
          })
          return m.print()
        }).pipe(Effect.provide(layerMemory)),
      )
      expect(text).toContain("Manifest")
      expect(text).toContain(NODE_A)
      expect(text).toContain("https://example.com")
      expect(text).toContain("Schemas")
      expect(text).toContain("Operations")
      expect(text).toContain("orders/Order@2.0.0")
      expect(text).toContain("orders.create@2.0.0")
    })

    it("includes deprecated entries by default; excludes when flagged", async () => {
      const [withDep, withoutDep] = await Effect.runPromise(
        Effect.gen(function* () {
          yield* seedRegistry
          const m = yield* Manifest.fromRegistry({ nodeId: NODE_A })
          return [
            m.print({ includeDeprecated: true }),
            m.print({ includeDeprecated: false }),
          ] as const
        }).pipe(Effect.provide(layerMemory)),
      )
      expect(withDep).toContain("\u2298") // deprecated icon
      expect(withoutDep).not.toContain("\u2298")
    })
  })

  describe("diffAgainst", () => {
    it("classifies adds, removes, and deprecations correctly", () => {
      const before = new Manifest({
        nodeId: NODE_A,
        revision: 1,
        asOf: "2026-01-01T00:00:00Z",
        schemas: [
          SchemaEntry.make({
            schemaId: "x/A",
            version: "1.0.0",
            schemaDocument: {},
            registeredAt: 1,
            originNodeId: NODE_A,
            deprecated: null,
          }),
          SchemaEntry.make({
            schemaId: "x/B",
            version: "1.0.0",
            schemaDocument: {},
            registeredAt: 2,
            originNodeId: NODE_A,
            deprecated: null,
          }),
        ],
        operations: [],
      })
      const after = new Manifest({
        nodeId: NODE_A,
        revision: 5,
        asOf: "2026-02-01T00:00:00Z",
        schemas: [
          // x/A: deprecated
          SchemaEntry.make({
            schemaId: "x/A",
            version: "1.0.0",
            schemaDocument: {},
            registeredAt: 1,
            originNodeId: NODE_A,
            deprecated: Deprecation.make({
              at: 100,
              successor: "2.0.0",
              reason: "test",
              originNodeId: NODE_A,
            }),
          }),
          // x/B: removed (not in after)
          // x/C: added
          SchemaEntry.make({
            schemaId: "x/C",
            version: "1.0.0",
            schemaDocument: {},
            registeredAt: 3,
            originNodeId: NODE_A,
            deprecated: null,
          }),
        ],
        operations: [],
      })
      const d = before.diffAgainst(after)
      expect(d.schemasAdded.map((s) => s.schemaId)).toEqual(["x/C"])
      expect(d.schemasRemoved.map((s) => s.schemaId)).toEqual(["x/B"])
      expect(d.schemasDeprecated.map((s) => s.schemaId)).toEqual(["x/A"])
    })

    it("diffPrint summarizes diff contents", () => {
      const m1 = new Manifest({
        nodeId: NODE_A,
        revision: 1,
        asOf: null,
        schemas: [],
        operations: [],
      })
      const m2 = new Manifest({
        nodeId: NODE_A,
        revision: 2,
        asOf: null,
        schemas: [
          SchemaEntry.make({
            schemaId: "x/Y",
            version: "1.0.0",
            schemaDocument: {},
            registeredAt: 1,
            originNodeId: NODE_A,
            deprecated: null,
          }),
        ],
        operations: [],
      })
      const text = m1.diffPrint(m2)
      expect(text).toContain("Diff:")
      expect(text).toContain("schemas added")
      expect(text).toContain("+ schema   x/Y@1.0.0")
    })
  })

  describe("federation precedence rule", () => {
    it("out-of-order arrival: older event is skipped, newer wins", async () => {
      // Simulates federation: NODE_A registers v1 at t=200 (newer);
      // NODE_B registers v1 at t=100 (older). Whichever order they
      // arrive, the registry should converge to NODE_A's entry.
      const arrivalOrder1 = [
        { node: NODE_A, at: 200 },
        { node: NODE_B, at: 100 },
      ]
      const arrivalOrder2 = [
        { node: NODE_B, at: 100 },
        { node: NODE_A, at: 200 },
      ]

      const finalForOrder = (order: ReadonlyArray<{ node: string; at: number }>) =>
        order.reduce((s, ev) => {
          return onSchemaRegistered(s, {
            schemaId: "x/Y",
            version: "1.0.0",
            schemaDocument: { winner: ev.node },
            registeredAt: ev.at,
            originNodeId: ev.node,
          })
        }, empty())

      const final1 = finalForOrder(arrivalOrder1)
      const final2 = finalForOrder(arrivalOrder2)

      const e1 = final1.schemas.get("x/Y@1.0.0")
      const e2 = final2.schemas.get("x/Y@1.0.0")
      expect(e1).toBeDefined()
      expect(e2).toBeDefined()
      // Both orders MUST converge to the same winner: NODE_A (later timestamp).
      expect(e1?.originNodeId).toBe(NODE_A)
      expect(e2?.originNodeId).toBe(NODE_A)
      expect((e1!.schemaDocument as { winner: string }).winner).toBe(NODE_A)
      expect((e2!.schemaDocument as { winner: string }).winner).toBe(NODE_A)
    })

    it("timestamp tie: lex-greater nodeId wins", async () => {
      // Same timestamp, different origins. Tiebreak by lex-greater
      // nodeId (deterministic, regardless of arrival order).
      const order1 = [
        { node: "node-A", at: 500 },
        { node: "node-B", at: 500 },
      ]
      const order2 = [
        { node: "node-B", at: 500 },
        { node: "node-A", at: 500 },
      ]

      const finalForOrder = (order: ReadonlyArray<{ node: string; at: number }>) =>
        order.reduce((s, ev) => {
          return onSchemaRegistered(s, {
            schemaId: "x/Y",
            version: "1.0.0",
            schemaDocument: { winner: ev.node },
            registeredAt: ev.at,
            originNodeId: ev.node,
          })
        }, empty())

      const e1 = finalForOrder(order1).schemas.get("x/Y@1.0.0")
      const e2 = finalForOrder(order2).schemas.get("x/Y@1.0.0")
      // node-B > node-A lexicographically; both orders converge to node-B.
      expect(e1?.originNodeId).toBe("node-B")
      expect(e2?.originNodeId).toBe("node-B")
    })
  })

  describe("PeerInfo (federation readout)", () => {
    it("Manifest with peers prints a Peers section", () => {
      const m = new Manifest({
        nodeId: NODE_A,
        revision: 1,
        asOf: null,
        schemas: [],
        operations: [],
        peers: [
          PeerInfo.make({
            nodeId: NODE_B,
            url: "https://b.example.com",
            syncStatus: "live",
            lastSyncAt: 1700000000000,
          }),
        ],
      })
      const text = m.print()
      expect(text).toContain("Peers (1)")
      expect(text).toContain(NODE_B)
      expect(text).toContain("(live)")
    })
  })
})
