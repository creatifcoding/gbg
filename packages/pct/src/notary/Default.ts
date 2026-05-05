/**
 * Default Notary layer — wires Identity + Clock + EventLog together.
 *
 * Captures all service dependencies at layer-construction time and
 * provides them inline to each method's Effect, so the resulting
 * `NotaryShape` methods are self-contained: callers `yield* Notary`
 * and call `.publish(...)` without needing to provide EventLog or
 * Registry themselves — Notary's layer already arranges for both.
 *
 * @module @tmnl/pct/notary/Default
 */

import * as Clock from "effect-v4/Clock"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Schema from "effect-v4/Schema"
import * as SchemaRepresentation from "effect-v4/SchemaRepresentation"
import * as EventLog from "effect-v4/unstable/eventlog/EventLog"

import { Identity } from "../identity/Identity.js"
import {
  deprecateOperation as lowDeprecateOperation,
  deprecateSchema as lowDeprecateSchema,
  publish as lowPublish,
  publishProcedure as lowPublishProcedure,
} from "../publish/Publish.js"
import { Registry } from "../registry/Registry.js"
import { RegistryGroup } from "../registry/RegistryEvents.js"
import { Notary } from "./Notary.js"

const eventSchema = EventLog.schema(RegistryGroup)

/**
 * The Default Notary layer. Auto-stamps every emitted event with:
 *   - `originNodeId` from `Identity`
 *   - `registeredAt` / `deprecatedAt` from `Clock.currentTimeMillis`
 *
 * Schema serialization for `registerSchema` happens inline via
 * `SchemaRepresentation.fromAST` + `DocumentFromJson`.
 *
 * Consumers needing different stamping behavior (federation,
 * migration tooling, deterministic tests) should bypass Notary and
 * use the lower-level `Publish` helpers or `EventLog.write` directly.
 */
export const Default: Layer.Layer<
  Notary,
  never,
  Identity | Registry | EventLog.EventLog
> = Layer.effect(
  Notary,
  Effect.gen(function* () {
    // Capture all dependencies once at construction.
    const identity = yield* Identity
    const log = yield* EventLog.EventLog
    const registry = yield* Registry

    return Notary.of({
      publish: (group) =>
        Effect.gen(function* () {
          const registeredAt = yield* Clock.currentTimeMillis
          return yield* lowPublish(group, {
            originNodeId: identity.nodeId,
            registeredAt,
          })
        }).pipe(
          Effect.provideService(EventLog.EventLog, log),
          Effect.provideService(Registry, registry),
        ),

      publishProcedure: (procedure) =>
        Effect.gen(function* () {
          const registeredAt = yield* Clock.currentTimeMillis
          return yield* lowPublishProcedure(procedure, {
            originNodeId: identity.nodeId,
            registeredAt,
          })
        }).pipe(Effect.provideService(EventLog.EventLog, log)),

      registerSchema: (name, version, schema, options) =>
        Effect.gen(function* () {
          const registeredAt = yield* Clock.currentTimeMillis
          const schemaDocument = Schema.encodeUnknownSync(
            SchemaRepresentation.DocumentFromJson,
          )(SchemaRepresentation.fromAST(schema.ast))
          yield* log.write({
            schema: eventSchema,
            event: "SchemaRegistered",
            payload: {
              schemaId: name,
              version,
              schemaDocument,
              registeredAt,
              originNodeId: identity.nodeId,
              ...(options?.description !== undefined
                ? { description: options.description }
                : {}),
            },
          })
          return { schemaId: `${name}@${version}` }
        }),

      deprecateSchema: (schemaName, version, options) =>
        lowDeprecateSchema(schemaName, version, {
          successor: options.successor ?? null,
          reason: options.reason,
          originNodeId: identity.nodeId,
        }).pipe(Effect.provideService(EventLog.EventLog, log)),

      deprecateOperation: (operationName, version, options) =>
        lowDeprecateOperation(operationName, version, {
          successor: options.successor ?? null,
          reason: options.reason,
          originNodeId: identity.nodeId,
        }).pipe(Effect.provideService(EventLog.EventLog, log)),
    })
  }),
)
