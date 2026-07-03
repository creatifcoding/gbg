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
 * # Modeling — schema-carrying record, not schema-validated data
 *
 * `Procedure` is a domain value that *carries* Effect Schemas in its
 * fields (input/output/errors). It's not a data record that needs
 * runtime validation of its own structure — instances are built from
 * trusted code via the factory functions below.
 *
 * The canonical Effect-TS pattern for this shape (as used by `Rpc.Rpc`,
 * `DurableDeferred`, `HttpApiEndpoint`) is:
 *
 *   1. A `TypeId` string brand for identity at the type-system layer
 *   2. A function-typed value with a shared `Proto` for `instanceof`
 *      / `Predicate.hasProperty` guards (analogous to `isRpc`)
 *   3. Schema fields stored directly as `Schema.Top` instances
 *      (no `Schema.Unknown` wrapping; no TaggedStruct)
 *   4. `Pipeable` for chainable transforms
 *
 * Pattern matching on Procedure values uses `isProcedure(u)` (TypeId
 * brand check). For pattern matching on procedure-by-name, callers
 * use the `name` field directly (it's the per-instance identity, just
 * like `Rpc.Rpc`'s `_tag` field).
 *
 * Deep wire-form serialization (Schema instances → `SchemaRepresentation
 * .Document`) lives separately in `Document.ts` — that's a transform
 * over the surface representation, not a property of the surface itself.
 *
 * @module @tmnl/pct/procedures/Procedure
 */

import { type Pipeable, pipeArguments } from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import type * as Schema from "effect/Schema"

import type { ProcedureKind } from "./ProcedureKind.js"

// ─── Brand ──────────────────────────────────────────────────────────────────

/**
 * Identity brand for Procedure values. Stored as a property key so
 * `Predicate.hasProperty(u, TypeId)` is the runtime guard.
 */
export const TypeId: unique symbol = Symbol.for("@tmnl/pct/Procedure")
export type TypeId = typeof TypeId

// ─── Type-level helpers ─────────────────────────────────────────────────────

/** Tagged-union helper: extract `Type` from a Schema, defaulting to `void`. */
export type SchemaType<S> = S extends Schema.Top ? S["Type"] : void

/** Tagged-union helper: collect Type values from an array of Schemas. */
export type SchemaTypes<Ss> = Ss extends ReadonlyArray<infer S>
  ? S extends Schema.Top
    ? S["Type"]
    : never
  : never

// ─── Procedure shape ────────────────────────────────────────────────────────

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
> extends Pipeable {
  // Phantom constructor signature: lets TS treat the value as a class-like
  // construct for `instanceof` purposes without ever permitting `new`.
  new (_: never): {}

  readonly [TypeId]: TypeId
  readonly name: Name
  readonly version: string
  readonly kind: Kind
  readonly input: Input
  readonly output: Output
  readonly errors: Errors
  readonly description?: string
}

// ─── Guard ──────────────────────────────────────────────────────────────────

/**
 * Runtime brand check. Returns `true` iff `u` is a Procedure value
 * (carries the TypeId property). Used for dispatchers that scan
 * unknown values (CLI module exports, handler binding tables, etc.).
 */
export const isProcedure = (u: unknown): u is Procedure =>
  Predicate.hasProperty(u, TypeId)

// ─── Proto + factory ────────────────────────────────────────────────────────

/**
 * Shared prototype for Procedure values. Holds the brand and the
 * Pipeable.pipe method. Per-instance fields (name, kind, schemas, etc.)
 * are assigned by `makeProto`.
 */
const Proto = {
  [TypeId]: TypeId,
  pipe(this: Procedure) {
    // eslint-disable-next-line prefer-rest-params
    return pipeArguments(this, arguments)
  },
} as const

const makeProto = <
  Name extends string,
  Kind extends ProcedureKind,
  Input extends Schema.Top,
  Output extends Schema.Top,
  Errors extends ReadonlyArray<Schema.Top>,
>(fields: {
  readonly name: Name
  readonly kind: Kind
  readonly version: string
  readonly input: Input
  readonly output: Output
  readonly errors: Errors
  readonly description?: string
}): Procedure<Name, Kind, Input, Output, Errors> => {
  // Plain object with Proto-chained prototype. Object.create is used
  // instead of `function Procedure() {}` (which `Rpc.Rpc` uses) because
  // our fields include a `name` property that conflicts with the
  // function value's read-only `.name`. Rpc doesn't hit this because
  // it carries `_tag`/`key` rather than a free `name` field.
  const instance = Object.create(Proto)
  Object.assign(instance, fields)
  return instance as Procedure<Name, Kind, Input, Output, Errors>
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
 *
 * Built via `makeProto` so the result carries the `TypeId` brand and
 * passes `isProcedure(value)` checks.
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
): Procedure<Name, Kind, Input, Output, Errors> =>
  makeProto({
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
