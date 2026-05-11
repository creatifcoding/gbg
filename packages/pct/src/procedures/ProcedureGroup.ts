/**
 * ProcedureGroup — a typed record of procedures.
 *
 * Per `PCT.md` §5, groups are records: composition is just object
 * literals. The group is what gets published to the registry and what
 * the client proxy is built from.
 *
 * Modeled the same way as `Procedure` — a schema-carrying value with a
 * TypeId brand for runtime identification (`isProcedureGroup` guard).
 *
 * @module @tmnl/pct/procedures/ProcedureGroup
 */

import { type Pipeable, pipeArguments } from "effect-v4/Pipeable"
import * as Predicate from "effect-v4/Predicate"

import type { Procedure } from "./Procedure.js"

// ─── Brand ──────────────────────────────────────────────────────────────────

export const TypeId: unique symbol = Symbol.for(
  "@tmnl/pct/ProcedureGroup",
)
export type TypeId = typeof TypeId

// ─── Type ───────────────────────────────────────────────────────────────────

/**
 * A ProcedureGroup is a typed record whose values are Procedures.
 *
 * The phantom type parameter `P` carries the tuple of procedure types
 * so that handler/client surfaces can derive precise types per name.
 */
export interface ProcedureGroup<
  out P extends ReadonlyArray<Procedure> = ReadonlyArray<Procedure>,
> extends Pipeable {
  new (_: never): {}

  readonly [TypeId]: TypeId
  readonly procedures: P
  /** Group identifier — used for namespacing and human-readable docs. */
  readonly name: string
  /** The collective version of this group (loose semver of group state). */
  readonly version?: string
  /** Human-readable description; flows to OpenAPI export. */
  readonly description?: string
}

// ─── Guard ──────────────────────────────────────────────────────────────────

export const isProcedureGroup = (u: unknown): u is ProcedureGroup =>
  Predicate.hasProperty(u, TypeId)

// ─── Proto + factory ────────────────────────────────────────────────────────

const Proto = {
  [TypeId]: TypeId,
  pipe(this: ProcedureGroup) {
    return pipeArguments(this, arguments)
  },
} as const

const makeProto = <const P extends ReadonlyArray<Procedure>>(fields: {
  readonly procedures: P
  readonly name: string
  readonly version?: string
  readonly description?: string
}): ProcedureGroup<P> => {
  // Plain object via Object.create to avoid the read-only-`name`
  // conflict that a `function ProcedureGroup() {}` value would have.
  const instance = Object.create(Proto)
  Object.assign(instance, fields)
  return instance as ProcedureGroup<P>
}

// ─── Constructors ───────────────────────────────────────────────────────────

/**
 * Construct a ProcedureGroup from a tuple of Procedures plus metadata.
 *
 * @example
 * ```ts
 * const Orders = ProcedureGroup.make({
 *   name: "orders",
 *   version: "2.1.4",
 * }, calculateTax, createOrder, watchOrders)
 * ```
 */
export const make = <const P extends ReadonlyArray<Procedure>>(
  metadata: {
    readonly name: string
    readonly version?: string
    readonly description?: string
  },
  ...procedures: P
): ProcedureGroup<P> =>
  makeProto({
    procedures,
    name: metadata.name,
    ...(metadata.version !== undefined ? { version: metadata.version } : {}),
    ...(metadata.description !== undefined
      ? { description: metadata.description }
      : {}),
  })

/** Quick constructor when you don't need metadata yet. */
export const of = <const P extends ReadonlyArray<Procedure>>(
  ...procedures: P
): ProcedureGroup<P> => makeProto({ procedures, name: "" })

// ─── Lookup ─────────────────────────────────────────────────────────────────

/**
 * Find a procedure within a group by name. Returns `undefined` if absent.
 */
export const findByName = <P extends ReadonlyArray<Procedure>>(
  group: ProcedureGroup<P>,
  name: string,
): Procedure | undefined =>
  group.procedures.find((p): p is Procedure => p.name === name)

/**
 * Find a procedure by `{name}@{version}` Schema-Id. Returns `undefined`
 * if absent.
 */
export const findBySchemaId = <P extends ReadonlyArray<Procedure>>(
  group: ProcedureGroup<P>,
  schemaId: string,
): Procedure | undefined =>
  group.procedures.find(
    (p): p is Procedure => `${p.name}@${p.version}` === schemaId,
  )

/** Map of `{name}@{version}` → Procedure for O(1) lookup. */
export const toMap = <P extends ReadonlyArray<Procedure>>(
  group: ProcedureGroup<P>,
): ReadonlyMap<string, Procedure> => {
  const m = new Map<string, Procedure>()
  for (const p of group.procedures) m.set(`${p.name}@${p.version}`, p)
  return m
}
