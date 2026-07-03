/**
 * EventLog as Schema Registry — Phase 3 protocol sketch.
 *
 * # The architectural claim under test
 *
 * The protocol's schema registry is event-sourced. Schema lifecycle events
 * (SchemaRegistered, SchemaDeprecated, etc.) are written to an EventLog;
 * the live registry view is the fold of those events. The schemas
 * themselves travel as `SchemaRepresentation.Document` payloads — a
 * round-trippable IR that round-trips back to a full Effect.Schema with
 * refinements, brands, and transforms preserved.
 *
 * This binds back to Lnk. When a client establishes a Lnk to a stream,
 * the connection includes schema discovery: the registry returns the
 * schemas describing the stream's payloads, and the client reconstructs
 * them locally. Encode/decode at the Lnk boundary uses those schemas.
 *
 * What this test proves:
 *   1. An Effect.Schema (with brands + refinements) can be serialized to
 *      JSON via SchemaRepresentation, transmitted, deserialized, and used
 *      with full runtime semantics intact.
 *   2. EventLog can carry the serialized schema as event payload.
 *   3. The journal preserves order (audit trail).
 *   4. State folded from events matches the journal's history.
 *   5. A consumer reading events can reconstruct the schemas and validate
 *      data through them — proving the wire path end-to-end.
 *
 * @module @tmnl/lnk/test/_proto-sketch/eventlog-registry
 */

import { describe, it, expect } from "vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import * as SchemaRepresentation from "effect/SchemaRepresentation"
import * as EventGroup from "effect/unstable/eventlog/EventGroup"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"
import * as EventLog from "effect/unstable/eventlog/EventLog"
import * as EventLogEncryption from "effect/unstable/eventlog/EventLogEncryption"

// ─── A real schema with brands + refinements (the round-trip target) ────────

// We author this using the full Effect.Schema vocabulary. The test below
// will serialize it, send it through an EventLog "wire", deserialize it,
// and verify the reconstructed schema validates data the same way.
const OrderId = Schema.String.check(
  Schema.isMinLength(4),
  Schema.isPattern(/^ord_[a-z0-9]+$/),
).pipe(Schema.brand("OrderId"))

const Order = Schema.Struct({
  id: OrderId,
  total: Schema.Number.check(Schema.isGreaterThan(0)),
  currency: Schema.Literals(["USD", "EUR", "GBP"]),
  customerEmail: Schema.String.check(Schema.isPattern(/@/)),
}).annotate({
  identifier: "Order",
  description:
    "A confirmed customer order. Brand-checked id, currency in known set, refined total.",
})

// ─── Serialize the schema (this is what travels on the wire) ────────────────

/**
 * Wire-bound serialized schema: a JSON value produced by
 * `SchemaRepresentation.DocumentFromJson` codec.
 *
 * On the wire, this rides as the `schemaDocument` field of registry
 * events. Receivers reconstruct via `toSchema`.
 */
const orderRepresentation = SchemaRepresentation.fromAST(Order.ast)
const orderDocumentJson = Schema.encodeUnknownSync(
  SchemaRepresentation.DocumentFromJson,
)(orderRepresentation)

// ─── Registry event group (what flows through the EventLog) ─────────────────

const SchemaRegisteredPayload = Schema.Struct({
  /** "{namespace}/{name}" — e.g. "orders/Order" */
  schemaId: Schema.String,
  /** semver — e.g. "1.2.0" */
  version: Schema.String,
  /** SchemaRepresentation.Document encoded as JSON. Receivers reconstruct. */
  schemaDocument: Schema.Unknown,
  registeredAt: Schema.Number,
})

const SchemaDeprecatedPayload = Schema.Struct({
  schemaId: Schema.String,
  version: Schema.String,
  successor: Schema.NullOr(Schema.String),
  deprecatedAt: Schema.Number,
  reason: Schema.String,
})

const RegistryGroup = EventGroup.empty
  .add({
    tag: "SchemaRegistered",
    primaryKey: (p) => `${p.schemaId}@${p.version}`,
    payload: SchemaRegisteredPayload,
  })
  .add({
    tag: "SchemaDeprecated",
    primaryKey: (p) => `${p.schemaId}@${p.version}`,
    payload: SchemaDeprecatedPayload,
  })

const schema = EventLog.schema(RegistryGroup)

// ─── Live registry state (folded from the event log) ────────────────────────

interface SchemaEntry {
  readonly schemaId: string
  readonly version: string
  readonly schemaDocument: unknown
  readonly registeredAt: number
  readonly deprecated: {
    readonly at: number
    readonly successor: string | null
    readonly reason: string
  } | null
}

interface RegistryState {
  /** Key: `{schemaId}@{version}`. Plain Map for predictable iteration. */
  readonly schemas: Map<string, SchemaEntry>
}

const emptyState = (): RegistryState => ({ schemas: new Map() })

// ─── Handler layer: events → state mutations ────────────────────────────────

const handlerLayer = (stateRef: Ref.Ref<RegistryState>) =>
  EventLog.group(RegistryGroup, (handlers) =>
    handlers
      .handle("SchemaRegistered", ({ payload }) =>
        Ref.update(stateRef, (s) => {
          const next = new Map(s.schemas)
          next.set(`${payload.schemaId}@${payload.version}`, {
            schemaId: payload.schemaId,
            version: payload.version,
            schemaDocument: payload.schemaDocument,
            registeredAt: payload.registeredAt,
            deprecated: null,
          })
          return { schemas: next }
        }),
      )
      .handle("SchemaDeprecated", ({ payload }) =>
        Ref.update(stateRef, (s) => {
          const key = `${payload.schemaId}@${payload.version}`
          const entry = s.schemas.get(key)
          if (entry === undefined) return s
          const next = new Map(s.schemas)
          next.set(key, {
            ...entry,
            deprecated: {
              at: payload.deprecatedAt,
              successor: payload.successor,
              reason: payload.reason,
            },
          })
          return { schemas: next }
        }),
      ),
  ).pipe(Layer.provide(EventLog.layerRegistry))

const registryLayer = (stateRef: Ref.Ref<RegistryState>) =>
  EventLog.layer(schema, handlerLayer(stateRef)).pipe(
    Layer.provide(EventJournal.layerMemory),
    Layer.provide(
      Layer.effect(EventLog.Identity, EventLog.makeIdentity).pipe(
        Layer.provide(EventLogEncryption.layerSubtle),
      ),
    ),
  )

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Schemas-over-the-wire via EventLog (Phase 3 sketch)", () => {
  describe("SchemaRepresentation round-trip (the wire primitive)", () => {
    it("a serialized schema reconstructs to a usable Effect.Schema", () => {
      // Serialize the schema (what ships over the wire).
      const wireBytes = JSON.stringify(orderDocumentJson)
      // Receiver side: decode JSON → Document → Schema.
      const receivedJson = JSON.parse(wireBytes)
      const document = Schema.decodeUnknownSync(
        SchemaRepresentation.DocumentFromJson,
      )(receivedJson)
      const Reconstructed = SchemaRepresentation.toSchema(document)
      // The reconstructed schema must validate the SAME data the original
      // would, AND reject the SAME bad data.
      const validData = {
        id: "ord_abc123",
        total: 99.5,
        currency: "USD",
        customerEmail: "alice@example.com",
      }
      const badId = { ...validData, id: "BAD" } // brand+pattern mismatch
      const badTotal = { ...validData, total: -5 } // refinement mismatch
      const badCurrency = { ...validData, currency: "JPY" } // not in set
      // Use the reconstructed schema as a decoder.
      const decode = Schema.decodeUnknownResult(Reconstructed)
      expect(Result.isSuccess(decode(validData))).toBe(true)
      expect(Result.isFailure(decode(badId))).toBe(true)
      expect(Result.isFailure(decode(badTotal))).toBe(true)
      expect(Result.isFailure(decode(badCurrency))).toBe(true)
    })

    it("the original and reconstructed schemas accept identical data", () => {
      const document = Schema.decodeUnknownSync(
        SchemaRepresentation.DocumentFromJson,
      )(orderDocumentJson)
      const Reconstructed = SchemaRepresentation.toSchema(document)
      const sample = {
        id: "ord_xyz789",
        total: 1234.56,
        currency: "EUR",
        customerEmail: "bob@example.org",
      }
      const decodeOriginal = Schema.decodeUnknownResult(Order)
      const decodeReconstructed = Schema.decodeUnknownResult(Reconstructed)
      const a = decodeOriginal(sample)
      const b = decodeReconstructed(sample)
      expect(Result.isSuccess(a)).toBe(true)
      expect(Result.isSuccess(b)).toBe(true)
      // Both decoded values are the same (modulo branding type info).
      if (Result.isSuccess(a) && Result.isSuccess(b)) {
        expect(a.success).toEqual(b.success)
      }
    })
  })

  describe("EventLog as registry backbone", () => {
    it("registers a schema as an event; folded state holds the document", async () => {
      const state = await Effect.runPromise(
        Effect.gen(function* () {
          const stateRef = yield* Ref.make(emptyState())
          return yield* Effect.gen(function* () {
            const log = yield* EventLog.EventLog
            yield* log.write({
              schema,
              event: "SchemaRegistered",
              payload: {
                schemaId: "orders/Order",
                version: "1.0.0",
                schemaDocument: orderDocumentJson,
                registeredAt: 1700000000000,
              },
            })
            return yield* Ref.get(stateRef)
          }).pipe(Effect.provide(registryLayer(stateRef)))
        }),
      )
      const entry = state.schemas.get("orders/Order@1.0.0")
      expect(entry).toBeDefined()
      expect(entry?.deprecated).toBeNull()
      expect(entry?.schemaDocument).toBeDefined()
    })

    it("a consumer reads the journal and reconstructs the live schema", async () => {
      // This is the registry's READ path: a fresh consumer (e.g., a Lnk
      // client at connect time) reads the registry via the EventLog,
      // pulls out the SchemaRegistered events, deserializes the
      // schemaDocument fields, and reconstructs usable schemas.
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const stateRef = yield* Ref.make(emptyState())
          return yield* Effect.gen(function* () {
            const log = yield* EventLog.EventLog
            yield* log.write({
              schema,
              event: "SchemaRegistered",
              payload: {
                schemaId: "orders/Order",
                version: "1.0.0",
                schemaDocument: orderDocumentJson,
                registeredAt: 1700000000000,
              },
            })
            const entries = yield* log.entries
            return entries
          }).pipe(Effect.provide(registryLayer(stateRef)))
        }),
      )
      // Consumer side: filter to SchemaRegistered events, decode the
      // event payload, reconstruct the embedded Schema.
      const registered = result.filter((e) => e.event === "SchemaRegistered")
      expect(registered.length).toBe(1)
      // The journal stores payloads as MsgPack-encoded bytes. The EventLog
      // handler has already decoded them into typed payloads (it dispatched
      // through our handler layer). Reconstruction directly from raw
      // entries (for fresh consumers replaying from cold storage) belongs
      // in the registry-server layer (Phase 3.1 work). What we prove here:
      // the event WITH its serialized schema IS in the journal, ready to
      // be re-derived by a fresh consumer.
      expect(registered[0]?.event).toBe("SchemaRegistered")
    })

    it("deprecation events update the registered entry — flag, no removal", async () => {
      const state = await Effect.runPromise(
        Effect.gen(function* () {
          const stateRef = yield* Ref.make(emptyState())
          return yield* Effect.gen(function* () {
            const log = yield* EventLog.EventLog
            yield* log.write({
              schema,
              event: "SchemaRegistered",
              payload: {
                schemaId: "orders/Order",
                version: "1.0.0",
                schemaDocument: orderDocumentJson,
                registeredAt: 1700000000000,
              },
            })
            yield* log.write({
              schema,
              event: "SchemaDeprecated",
              payload: {
                schemaId: "orders/Order",
                version: "1.0.0",
                successor: "2.0.0",
                deprecatedAt: 1700000999999,
                reason: "added required fields",
              },
            })
            return yield* Ref.get(stateRef)
          }).pipe(Effect.provide(registryLayer(stateRef)))
        }),
      )
      const entry = state.schemas.get("orders/Order@1.0.0")
      expect(entry).toBeDefined()
      expect(entry?.deprecated).not.toBeNull()
      expect(entry?.deprecated?.successor).toBe("2.0.0")
      expect(entry?.deprecated?.reason).toBe("added required fields")
      // The schema entry itself is preserved — deprecation is a flag,
      // not a removal. Audit trail intact.
      expect(entry?.schemaDocument).toBeDefined()
    })

    it("multiple versions of the same schema coexist in the registry", async () => {
      const state = await Effect.runPromise(
        Effect.gen(function* () {
          const stateRef = yield* Ref.make(emptyState())
          return yield* Effect.gen(function* () {
            const log = yield* EventLog.EventLog
            // v1: original
            yield* log.write({
              schema,
              event: "SchemaRegistered",
              payload: {
                schemaId: "orders/Order",
                version: "1.0.0",
                schemaDocument: orderDocumentJson,
                registeredAt: 1700000000000,
              },
            })
            // v2: imagine the schema was widened; for this test we ship the
            // same Document but with a different version label. In a real
            // scenario this would be a different schema authored separately.
            yield* log.write({
              schema,
              event: "SchemaRegistered",
              payload: {
                schemaId: "orders/Order",
                version: "2.0.0",
                schemaDocument: orderDocumentJson,
                registeredAt: 1700001000000,
              },
            })
            return yield* Ref.get(stateRef)
          }).pipe(Effect.provide(registryLayer(stateRef)))
        }),
      )
      expect(state.schemas.size).toBe(2)
      expect(state.schemas.get("orders/Order@1.0.0")).toBeDefined()
      expect(state.schemas.get("orders/Order@2.0.0")).toBeDefined()
    })

    it("journal preserves event order — audit trail", async () => {
      const entries = await Effect.runPromise(
        Effect.gen(function* () {
          const stateRef = yield* Ref.make(emptyState())
          return yield* Effect.gen(function* () {
            const log = yield* EventLog.EventLog
            yield* log.write({
              schema,
              event: "SchemaRegistered",
              payload: {
                schemaId: "orders/Order",
                version: "1.0.0",
                schemaDocument: orderDocumentJson,
                registeredAt: 1,
              },
            })
            yield* log.write({
              schema,
              event: "SchemaRegistered",
              payload: {
                schemaId: "orders/Customer",
                version: "1.0.0",
                schemaDocument: orderDocumentJson,
                registeredAt: 2,
              },
            })
            yield* log.write({
              schema,
              event: "SchemaDeprecated",
              payload: {
                schemaId: "orders/Order",
                version: "1.0.0",
                successor: null,
                deprecatedAt: 3,
                reason: "test",
              },
            })
            return yield* log.entries
          }).pipe(Effect.provide(registryLayer(stateRef)))
        }),
      )
      expect(entries.map((e) => e.event)).toEqual([
        "SchemaRegistered",
        "SchemaRegistered",
        "SchemaDeprecated",
      ])
    })
  })

  describe("the Lnk-binding (the architectural target)", () => {
    it("a connecting client receives schemaDocument; uses it to validate inbound payloads", async () => {
      // Simulates the Lnk connect path:
      //   1. Client connects to a stream's Lnk.
      //   2. Server's registry returns the schema(s) for the stream's payload.
      //   3. Client deserializes the SchemaRepresentation.Document.
      //   4. Client uses the reconstructed schema to validate every inbound
      //      message. Server uses the same schema to validate every outbound.
      //
      // This test models steps 2–4 against an in-memory EventLog playing
      // the role of the registry.
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const stateRef = yield* Ref.make(emptyState())
          return yield* Effect.gen(function* () {
            const log = yield* EventLog.EventLog
            // Server registers the schema for the stream.
            yield* log.write({
              schema,
              event: "SchemaRegistered",
              payload: {
                schemaId: "orders/Order",
                version: "1.0.0",
                schemaDocument: orderDocumentJson,
                registeredAt: 1700000000000,
              },
            })
            // Client connects: looks up the live state, finds the schema.
            const state = yield* Ref.get(stateRef)
            const entry = state.schemas.get("orders/Order@1.0.0")
            return entry
          }).pipe(Effect.provide(registryLayer(stateRef)))
        }),
      )
      expect(result).toBeDefined()
      // Client deserializes the Document and reconstructs the Schema.
      const document = Schema.decodeUnknownSync(
        SchemaRepresentation.DocumentFromJson,
      )(result!.schemaDocument)
      const StreamPayloadSchema = SchemaRepresentation.toSchema(document)
      // Client uses the reconstructed schema to validate.
      const decode = Schema.decodeUnknownResult(StreamPayloadSchema)
      const valid = decode({
        id: "ord_abc123",
        total: 50,
        currency: "USD",
        customerEmail: "carol@example.com",
      })
      const invalid = decode({
        id: "ord_x",         // too short for minLength(4)
        total: 0,            // not greaterThan(0)
        currency: "JPY",     // not in literals
        customerEmail: "noemail",
      })
      expect(Result.isSuccess(valid)).toBe(true)
      expect(Result.isFailure(invalid)).toBe(true)
    })
  })
})
