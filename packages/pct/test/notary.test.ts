/**
 * Notary tests — verify the automagic authoring surface.
 *
 * Properties verified:
 *   - Notary auto-stamps `originNodeId` from Identity
 *   - Notary auto-stamps `registeredAt` / `deprecatedAt` from Clock
 *   - Caller never touches EventLog or registry-event metadata
 *   - Publishing a ProcedureGroup produces matching registry state
 *   - Schema deprecation flows through to the registry
 *   - Notary can register a single schema directly (no procedure)
 *   - Identity layers (ephemeral) produce stable nodeIds within a process
 */

import { describe, expect, it } from "vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"

import { Identity } from "../src/identity/Identity.js"
import * as IdentityLayers from "../src/identity/Layers.js"
import { Notary } from "../src/notary/Notary.js"
import * as NotaryDefault from "../src/notary/Default.js"
import * as Procedure from "../src/procedures/Procedure.js"
import * as ProcedureGroup from "../src/procedures/ProcedureGroup.js"
import { Registry } from "../src/registry/Registry.js"
import * as RegistryMemory from "../src/registry/Memory.js"

// ─── Test fixtures ──────────────────────────────────────────────────────────

const HeartRateInput = Schema.Struct({
  bpm: Schema.Number,
  deviceId: Schema.String,
})

const HeartRate = Schema.Struct({
  bpm: Schema.Number,
  observedAt: Schema.String,
  deviceId: Schema.String,
})

class InvalidDeviceError extends Schema.TaggedErrorClass<InvalidDeviceError>()(
  "InvalidDeviceError",
  { deviceId: Schema.String },
) {}

const submitReading = Procedure.mutation("vitals.submitReading", {
  input: HeartRateInput,
  output: HeartRate,
  errors: [InvalidDeviceError],
  version: "1.0.0",
})

const Vitals = ProcedureGroup.make(
  { name: "vitals", version: "1.0.0" },
  submitReading,
)

// ─── Layer composition ──────────────────────────────────────────────────────

/**
 * Production-shaped layer composition: Identity → EventLog (substrate) →
 *   Registry (read-side, folds events) → Notary (write-side).
 *
 * Uses `provideMerge` (not `provide`) so all merged outputs (Notary,
 * Registry, EventLog, Identity) remain visible to the test — each
 * test `yield*`s several of these directly.
 */
const TestLayer = NotaryDefault.Default.pipe(
  Layer.provideMerge(RegistryMemory.layer),
  Layer.provideMerge(IdentityLayers.layerEphemeral),
  Layer.provideMerge(EventJournal.layerMemory),
)

// ─── Tests ──────────────────────────────────────────────────────────────────

const run = <A>(eff: Effect.Effect<A, unknown, Notary | Registry | Identity>) =>
  Effect.runPromise(eff.pipe(Effect.provide(TestLayer)) as Effect.Effect<A>)

describe("Notary", () => {
  it("publish auto-stamps originNodeId and registeredAt", async () => {
    await run(
      Effect.gen(function* () {
        const notary = yield* Notary
        const identity = yield* Identity
        const registry = yield* Registry

        const result = yield* notary.publish(Vitals)

        expect(result.procedures).toHaveLength(1)
        expect(result.revision).toBeGreaterThan(0)

        const snapshot = yield* registry.snapshot
        const schemas = Array.from(snapshot.schemas.values())
        const operations = Array.from(snapshot.operations.values())

        for (const entry of schemas) {
          expect(entry.originNodeId).toBe(identity.nodeId)
          expect(entry.registeredAt).toBeGreaterThan(0)
        }
        for (const op of operations) {
          expect(op.originNodeId).toBe(identity.nodeId)
          expect(op.registeredAt).toBeGreaterThan(0)
        }
      }),
    )
  })

  it("publish writes 3 schemas (input + output + error) and 1 operation", async () => {
    await run(
      Effect.gen(function* () {
        const notary = yield* Notary
        const registry = yield* Registry

        yield* notary.publish(Vitals)

        const snapshot = yield* registry.snapshot
        expect(snapshot.schemas.size).toBe(3)
        expect(snapshot.operations.size).toBe(1)
      }),
    )
  })

  it("registerSchema writes a single schema entry", async () => {
    await run(
      Effect.gen(function* () {
        const notary = yield* Notary
        const registry = yield* Registry
        const identity = yield* Identity

        const Order = Schema.Struct({
          orderId: Schema.String,
          total: Schema.Number,
        })

        const { schemaId } = yield* notary.registerSchema(
          "orders/Order",
          "1.0.0",
          Order,
          { description: "A purchase order" },
        )

        expect(schemaId).toBe("orders/Order@1.0.0")

        const snapshot = yield* registry.snapshot
        expect(snapshot.schemas.size).toBe(1)
        const entry = snapshot.schemas.get(schemaId)
        expect(entry).toBeDefined()
        expect(entry?.originNodeId).toBe(identity.nodeId)
        expect(entry?.description).toBe("A purchase order")
      }),
    )
  })

  it("deprecateSchema flags the entry with deprecation metadata", async () => {
    await run(
      Effect.gen(function* () {
        const notary = yield* Notary
        const registry = yield* Registry
        const identity = yield* Identity

        const Order = Schema.Struct({ orderId: Schema.String })
        yield* notary.registerSchema("orders/Order", "1.0.0", Order)

        yield* notary.deprecateSchema("orders/Order", "1.0.0", {
          successor: "orders/Order@2.0.0",
          reason: "added required fields",
        })

        const snapshot = yield* registry.snapshot
        const entry = snapshot.schemas.get("orders/Order@1.0.0")
        expect(entry?.deprecated).toBeDefined()
        expect(entry?.deprecated?.successor).toBe("orders/Order@2.0.0")
        expect(entry?.deprecated?.reason).toBe("added required fields")
        expect(entry?.deprecated?.originNodeId).toBe(identity.nodeId)
      }),
    )
  })

  it("deprecateOperation flags the operation entry", async () => {
    await run(
      Effect.gen(function* () {
        const notary = yield* Notary
        const registry = yield* Registry

        yield* notary.publish(Vitals)
        yield* notary.deprecateOperation("vitals.submitReading", "1.0.0", {
          reason: "renamed",
        })

        const snapshot = yield* registry.snapshot
        const op = snapshot.operations.get("vitals.submitReading@1.0.0")
        expect(op?.deprecated).toBeDefined()
        expect(op?.deprecated?.reason).toBe("renamed")
        expect(op?.deprecated?.successor).toBeNull()
      }),
    )
  })

  it("Identity nodeId is stable within a process (same layer instance)", async () => {
    await run(
      Effect.gen(function* () {
        const id1 = yield* Identity
        const id2 = yield* Identity
        expect(id1.nodeId).toBe(id2.nodeId)
        expect(id1.nodeId).toMatch(/^pct:[0-9a-f]{8}$/)
      }),
    )
  })

  it("publish round-trips: publish → registry observes the procedure", async () => {
    await run(
      Effect.gen(function* () {
        const notary = yield* Notary
        const registry = yield* Registry

        yield* notary.publish(Vitals)

        const snapshot = yield* registry.snapshot
        const op = snapshot.operations.get("vitals.submitReading@1.0.0")
        expect(op).toBeDefined()
        expect(op?.kind).toBe("mutation")
        expect(op?.inputSchemaId).toBe("vitals.submitReading/Input@1.0.0")
        expect(op?.outputSchemaId).toBe("vitals.submitReading/Output@1.0.0")
        expect(op?.errorSchemaIds).toContain(
          "vitals.submitReading/Error_0@1.0.0",
        )
      }),
    )
  })
})
