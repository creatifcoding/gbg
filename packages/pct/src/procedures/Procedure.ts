/**
 * Procedure — the unit of authoring. A typed, named, versioned operation.
 *
 * Per `PCT.md` §5 (authoring), procedures are first-class values:
 *
 *   - `name`     — dotted identifier (`namespace.procedure`)
 *   - `version`  — semver string
 *   - `kind`     — execution model (pure/query/mutation/stream/duplex)
 *   - `input`    — Effect.Schema describing the input payload
 *   - `output`   — Effect.Schema describing the success payload
 *   - `errors`   — array of Effect.Schemas describing typed errors
 *
 * A Procedure carries enough information to:
 *   - Serialize to a `Procedure.Document` (schemas as
 *     `SchemaRepresentation.Document`, plus metadata)
 *   - Be published to a registry (becomes one or more SchemaRegistered
 *     events plus an OperationRegistered event)
 *   - Be bound to a handler implementation
 *   - Drive a typed client surface
 *
 * @module @tmnl/pct/procedures/Procedure
 */

import type * as Schema from "effect-v4/Schema"

import type { ProcedureKind } from "./ProcedureKind.js"

// ─── Type-level helpers ─────────────────────────────────────────────────────

/** Tagged-union helper: extract `Type` from a Schema, defaulting to `void`. */
export type SchemaType<S> = S extends Schema.Top ? S["Type"] : void

/** Tagged-union helper: collect Type values from an array of Schemas. */
export type SchemaTypes<Ss> = Ss extends ReadonlyArray<infer S>
  ? S extends Schema.Top
    ? S["Type"]
    : never
  : never

// ─── Procedure ──────────────────────────────────────────────────────────────

/**
 * A single procedure spec value.
 *
 * Generic parameters carry static type info for client/handler ergonomics:
 *   - `Name`        — string literal of the procedure name
 *   - `Kind`        — one of ProcedureKind
 *   - `Input`       — Schema of the input payload
 *   - `Output`      — Schema of the output payload
 *   - `Errors`      — array of Schemas for typed errors
 */
export interface Procedure<
  out Name extends string = string,
  out Kind extends ProcedureKind = ProcedureKind,
  out Input extends Schema.Top = Schema.Top,
  out Output extends Schema.Top = Schema.Top,
  out Errors extends ReadonlyArray<Schema.Top> = ReadonlyArray<Schema.Top>,
> {
  readonly name: Name
  readonly version: string
  readonly kind: Kind
  readonly input: Input
  readonly output: Output
  readonly errors: Errors
  readonly description?: string
}

// ─── Constructors per kind ──────────────────────────────────────────────────

/** Construction options for any procedure kind. */
export interface ProcedureOptions<
  Input extends Schema.Top,
  Output extends Schema.Top,
  Errors extends ReadonlyArray<Schema.Top>,
> {
  readonly input: Input
  readonly output: Output
  readonly errors?: Errors
  readonly version: string
  readonly description?: string
}

/**
 * Construct a procedure of arbitrary kind. The kind-specific constructors
 * below (`pure`, `query`, `mutation`, `stream`, `duplex`) wrap this with
 * the correct kind tag.
 */
export const make = <
  Name extends string,
  Kind extends ProcedureKind,
  Input extends Schema.Top,
  Output extends Schema.Top,
  Errors extends ReadonlyArray<Schema.Top>,
>(
  name: Name,
  kind: Kind,
  options: ProcedureOptions<Input, Output, Errors>,
): Procedure<Name, Kind, Input, Output, Errors> => ({
  name,
  kind,
  version: options.version,
  input: options.input,
  output: options.output,
  errors: (options.errors ?? ([] as unknown)) as Errors,
  ...(options.description !== undefined
    ? { description: options.description }
    : {}),
})

/** Construct a `pure` procedure (stateless, deterministic, cacheable). */
export const pure = <
  Name extends string,
  Input extends Schema.Top,
  Output extends Schema.Top,
  Errors extends ReadonlyArray<Schema.Top> = readonly [],
>(
  name: Name,
  options: ProcedureOptions<Input, Output, Errors>,
): Procedure<Name, "pure", Input, Output, Errors> => make(name, "pure", options)

/** Construct a `query` procedure (stateless read of server state). */
export const query = <
  Name extends string,
  Input extends Schema.Top,
  Output extends Schema.Top,
  Errors extends ReadonlyArray<Schema.Top> = readonly [],
>(
  name: Name,
  options: ProcedureOptions<Input, Output, Errors>,
): Procedure<Name, "query", Input, Output, Errors> =>
  make(name, "query", options)

/** Construct a `mutation` procedure (stateful single-shot write). */
export const mutation = <
  Name extends string,
  Input extends Schema.Top,
  Output extends Schema.Top,
  Errors extends ReadonlyArray<Schema.Top> = readonly [],
>(
  name: Name,
  options: ProcedureOptions<Input, Output, Errors>,
): Procedure<Name, "mutation", Input, Output, Errors> =>
  make(name, "mutation", options)

/** Construct a `stream` procedure (server→client unbounded sequence). */
export const stream = <
  Name extends string,
  Input extends Schema.Top,
  Output extends Schema.Top,
  Errors extends ReadonlyArray<Schema.Top> = readonly [],
>(
  name: Name,
  options: ProcedureOptions<Input, Output, Errors>,
): Procedure<Name, "stream", Input, Output, Errors> =>
  make(name, "stream", options)

/** Construct a `duplex` procedure (bidirectional; WebSocket binding). */
export const duplex = <
  Name extends string,
  Input extends Schema.Top,
  Output extends Schema.Top,
  Errors extends ReadonlyArray<Schema.Top> = readonly [],
>(
  name: Name,
  options: ProcedureOptions<Input, Output, Errors>,
): Procedure<Name, "duplex", Input, Output, Errors> =>
  make(name, "duplex", options)

// ─── Schema-Id derivation ───────────────────────────────────────────────────

/**
 * Derive the canonical (long-form) Schema-Id for a procedure.
 *
 * Default form: `{name}@{version}`. Per PCT.md §6, this is opaque on the
 * wire — clients MUST NOT parse it. The registry MAY issue alternative
 * compact codes via `Accept-Schema-Id-Format: short`.
 */
export const schemaId = <P extends Procedure>(procedure: P): string =>
  `${procedure.name}@${procedure.version}`
