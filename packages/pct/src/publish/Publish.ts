/**
 * Publish — the bridge from `Procedure` values to registry events.
 *
 * `Pact.publish(group)` is the high-level entry point: takes a
 * `ProcedureGroup`, decomposes each procedure into its constituent
 * schemas (input, output, errors), and writes the corresponding
 * `SchemaRegistered` + `OperationRegistered` events to the local
 * registry's EventLog.
 *
 * This is what specs become at runtime — events in a journal, folded
 * into the live `Registry` view, replicated to peers via federation.
 *
 * @module @tmnl/pct/publish/Publish
 */

import * as Clock from "effect-v4/Clock"
import * as Effect from "effect-v4/Effect"
import * as EventJournal from "effect-v4/unstable/eventlog/EventJournal"
import * as EventLog from "effect-v4/unstable/eventlog/EventLog"

import { toDocument } from "../procedures/Document.js"
import type { Procedure } from "../procedures/Procedure.js"
import type { ProcedureGroup } from "../procedures/ProcedureGroup.js"
import { Registry } from "../registry/Registry.js"
import { RegistryGroup } from "../registry/RegistryEvents.js"

const schema = EventLog.schema(RegistryGroup)

// ─── Options + result shape ────────────────────────────────────────────────

export interface PublishOptions {
  /**
   * Identifier of the node initiating the publish. Stamped onto every
   * emitted event as `originNodeId`. Default: "self".
   */
  readonly originNodeId?: string
  /**
   * Override the publish timestamp (for deterministic tests). Default:
   * `Effect.clock.currentTimeMillis`.
   */
  readonly registeredAt?: number
}

export interface PublishedProcedure {
  readonly name: string
  readonly version: string
  readonly schemaId: string                 // "{name}@{version}"
  readonly inputSchemaId: string            // "<inferred>/<input>@{version}"
  readonly outputSchemaId: string
  readonly errorSchemaIds: ReadonlyArray<string>
}

export interface PublishResult {
  /** Procedures successfully written. */
  readonly procedures: ReadonlyArray<PublishedProcedure>
  /** Registry revision after the publish. */
  readonly revision: number
  /** Wall-clock timestamp the publish was applied at. */
  readonly publishedAt: number
}

// ─── Procedure-level publish ────────────────────────────────────────────────

/**
 * Publish a single procedure. Writes:
 *   - One `SchemaRegistered` event per unique schema referenced
 *     (input, output, each error).
 *   - One `OperationRegistered` event tying the procedure name+version
 *     to the schema-ids.
 *
 * Schema-Ids for embedded schemas are derived from the procedure's
 * version namespace: input → `${procedure.name}/Input@${version}`,
 * output → `${procedure.name}/Output@${version}`, errors[i] →
 * `${procedure.name}/Error_${i}@${version}`. Future iterations may
 * accept explicit schemaId overrides via Schema annotations.
 */
export const publishProcedure = (
  procedure: Procedure,
  options: PublishOptions = {},
): Effect.Effect<
  PublishedProcedure,
  EventJournal.EventJournalError,
  EventLog.EventLog
> =>
  Effect.gen(function* () {
    const log = yield* EventLog.EventLog
    const originNodeId = options.originNodeId ?? "self"
    const registeredAt =
      options.registeredAt ?? (yield* Clock.currentTimeMillis)

    const document = toDocument(procedure)

    // Synthesize schema-ids for each component schema.
    const inputSchemaIdBase = `${procedure.name}/Input`
    const outputSchemaIdBase = `${procedure.name}/Output`
    const inputSchemaId = `${inputSchemaIdBase}@${procedure.version}`
    const outputSchemaId = `${outputSchemaIdBase}@${procedure.version}`
    const errorSchemaIds: Array<string> = []

    // Write SchemaRegistered for input
    yield* log.write({
      schema,
      event: "SchemaRegistered",
      payload: {
        schemaId: inputSchemaIdBase,
        version: procedure.version,
        schemaDocument: document.inputDocument,
        registeredAt,
        originNodeId,
        ...(procedure.description !== undefined
          ? { description: `Input for ${procedure.name}` }
          : {}),
      },
    })

    // Write SchemaRegistered for output
    yield* log.write({
      schema,
      event: "SchemaRegistered",
      payload: {
        schemaId: outputSchemaIdBase,
        version: procedure.version,
        schemaDocument: document.outputDocument,
        registeredAt,
        originNodeId,
        ...(procedure.description !== undefined
          ? { description: `Output for ${procedure.name}` }
          : {}),
      },
    })

    // Write SchemaRegistered for each error
    for (let i = 0; i < document.errorDocuments.length; i++) {
      const errSchemaIdBase = `${procedure.name}/Error_${i}`
      const errSchemaId = `${errSchemaIdBase}@${procedure.version}`
      yield* log.write({
        schema,
        event: "SchemaRegistered",
        payload: {
          schemaId: errSchemaIdBase,
          version: procedure.version,
          schemaDocument: document.errorDocuments[i] as unknown,
          registeredAt,
          originNodeId,
        },
      })
      errorSchemaIds.push(errSchemaId)
    }

    // Write OperationRegistered referencing all the schema-ids
    yield* log.write({
      schema,
      event: "OperationRegistered",
      payload: {
        name: procedure.name,
        version: procedure.version,
        kind: procedure.kind,
        inputSchemaId,
        outputSchemaId,
        errorSchemaIds,
        registeredAt,
        originNodeId,
        ...(procedure.description !== undefined
          ? { description: procedure.description }
          : {}),
      },
    })

    return {
      name: procedure.name,
      version: procedure.version,
      schemaId: `${procedure.name}@${procedure.version}`,
      inputSchemaId,
      outputSchemaId,
      errorSchemaIds,
    }
  })

// ─── Group-level publish ────────────────────────────────────────────────────

/**
 * Publish an entire `ProcedureGroup` to the local registry's EventLog.
 *
 * Runs each procedure's publish sequentially so that the resulting
 * registry revision is monotonically advanced one publish at a time
 * (avoids interleaved partial states during read).
 */
export const publish = (
  group: ProcedureGroup,
  options: PublishOptions = {},
): Effect.Effect<
  PublishResult,
  EventJournal.EventJournalError,
  Registry | EventLog.EventLog
> =>
  Effect.gen(function* () {
    const registry = yield* Registry
    const published: Array<PublishedProcedure> = []
    for (const procedure of group.procedures) {
      const p = yield* publishProcedure(procedure, options)
      published.push(p)
    }
    const revision = yield* registry.revision
    const publishedAt =
      options.registeredAt ?? (yield* Clock.currentTimeMillis)
    return {
      procedures: published,
      revision,
      publishedAt,
    }
  })
