/**
 * Document — serialized form of a `Procedure` and `ProcedureGroup`.
 *
 * A `ProcedureDocument` is what travels over the wire: name, version,
 * kind, plus the input/output/error schemas serialized as
 * `SchemaRepresentation.Document` JSON values. `fromDocument` reconstructs
 * a usable `Procedure` with full Effect.Schema runtime semantics
 * (refinements, brands, transforms preserved).
 *
 * This is the bridge between Phase 3.0's value-type authoring and Phase
 * 3.3's `Pact.publish` (which writes Documents into the registry's
 * EventLog as `SchemaRegistered` + `OperationRegistered` event payloads).
 *
 * @module @tmnl/pct/procedures/Document
 */

import * as Schema from "effect-v4/Schema"
import * as SchemaRepresentation from "effect-v4/SchemaRepresentation"

import { make as makeProcedure, type Procedure } from "./Procedure.js"
import type { ProcedureKind } from "./ProcedureKind.js"
import { make as makeGroup, type ProcedureGroup } from "./ProcedureGroup.js"

// ─── Document types ─────────────────────────────────────────────────────────

/**
 * A `Procedure` rendered as a wire-portable JSON document.
 *
 * `inputDocument`, `outputDocument`, and each entry of `errorDocuments`
 * are JSON values produced by encoding a
 * `SchemaRepresentation.Document` via `DocumentFromJson`. They round-trip
 * back to full Effect.Schemas via `SchemaRepresentation.toSchema` after
 * decoding through the same codec.
 */
export interface ProcedureDocument {
  readonly name: string
  readonly version: string
  readonly kind: ProcedureKind
  readonly inputDocument: unknown
  readonly outputDocument: unknown
  readonly errorDocuments: ReadonlyArray<unknown>
  readonly description?: string
}

/**
 * A `ProcedureGroup` rendered as a wire-portable JSON document.
 *
 * Carries group metadata plus an array of `ProcedureDocument`s — one
 * per member procedure.
 */
export interface ProcedureGroupDocument {
  readonly name: string
  readonly version?: string
  readonly description?: string
  readonly procedures: ReadonlyArray<ProcedureDocument>
}

// ─── Procedure → Document ──────────────────────────────────────────────────

/**
 * Encode a `Procedure` value into a wire-portable `ProcedureDocument`.
 *
 * Each schema (input, output, errors[]) is converted to a
 * `SchemaRepresentation.Document` and then JSON-encoded. The result is
 * a plain JSON value safe to embed in events, transmit over HTTP, or
 * persist to disk.
 */
export const toDocument = (procedure: Procedure): ProcedureDocument => {
  const inputJson = serializeSchema(procedure.input)
  const outputJson = serializeSchema(procedure.output)
  const errorJsons = procedure.errors.map(serializeSchema)
  return {
    name: procedure.name,
    version: procedure.version,
    kind: procedure.kind,
    inputDocument: inputJson,
    outputDocument: outputJson,
    errorDocuments: errorJsons,
    ...(procedure.description !== undefined
      ? { description: procedure.description }
      : {}),
  }
}

// ─── Document → Procedure ───────────────────────────────────────────────────

/**
 * Decode a `ProcedureDocument` back into a usable `Procedure`.
 *
 * Reconstructs each embedded schema via `SchemaRepresentation.toSchema`,
 * then assembles a Procedure value. The reconstructed Procedure has the
 * same runtime validation semantics as the original — brands,
 * refinements (`isMinLength`, `isPattern`, `isGreaterThan`, …), literal
 * unions, struct annotations all survive the round trip.
 *
 * The returned type is the most general `Procedure` (compile-time type
 * info is erased through serialization). For typed client/handler
 * surfaces, hold on to the original procedure values and use those
 * directly; reserve `fromDocument` for dynamic dispatch flows.
 */
export const fromDocument = (document: ProcedureDocument): Procedure => {
  const input = deserializeSchema(document.inputDocument)
  const output = deserializeSchema(document.outputDocument)
  const errors = document.errorDocuments.map(deserializeSchema)
  return makeProcedure(document.name, document.kind, {
    input,
    output,
    errors,
    version: document.version,
    ...(document.description !== undefined
      ? { description: document.description }
      : {}),
  })
}

// ─── ProcedureGroup ↔ Document ──────────────────────────────────────────────

/** Encode a `ProcedureGroup` into a wire-portable document. */
export const toGroupDocument = (
  group: ProcedureGroup,
): ProcedureGroupDocument => ({
  name: group.name,
  ...(group.version !== undefined ? { version: group.version } : {}),
  ...(group.description !== undefined ? { description: group.description } : {}),
  procedures: group.procedures.map(toDocument),
})

/** Decode a `ProcedureGroupDocument` back into a `ProcedureGroup`. */
export const fromGroupDocument = (
  document: ProcedureGroupDocument,
): ProcedureGroup => {
  const procedures = document.procedures.map(fromDocument)
  return makeGroup(
    {
      name: document.name,
      ...(document.version !== undefined ? { version: document.version } : {}),
      ...(document.description !== undefined
        ? { description: document.description }
        : {}),
    },
    ...procedures,
  )
}

// ─── Internal helpers (not exported) ────────────────────────────────────────

/** Schema → SchemaRepresentation.Document → JSON. */
const serializeSchema = (schema: Schema.Top): unknown => {
  const document = SchemaRepresentation.fromAST(schema.ast)
  return Schema.encodeUnknownSync(SchemaRepresentation.DocumentFromJson)(
    document,
  )
}

/** JSON → SchemaRepresentation.Document → Schema. */
const deserializeSchema = (json: unknown): Schema.Top => {
  const document = Schema.decodeUnknownSync(
    SchemaRepresentation.DocumentFromJson,
  )(json)
  return SchemaRepresentation.toSchema(document)
}
