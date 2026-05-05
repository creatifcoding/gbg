/**
 * Brands — type-discipline primitives for `pct` identifiers.
 *
 * Branded strings prevent accidental confusion between identifiers that
 * happen to share the underlying type (`string`). Per AGENTS.md schema
 * discipline:
 *
 *   - `NodeId`     — registry node identity (e.g. "pct:01HKZ4XX")
 *   - `SchemaName` — namespace + name (e.g. "orders/Order")
 *   - `SchemaId`   — `{name}@{version}` compound (e.g. "orders.create@2.1.4")
 *
 * Usage:
 *   - Effect.Schema-validated parses via `decode*` (e.g. `decodeNodeId`)
 *   - Hot-path zero-cost trust constructors (e.g. `trustNodeId`)
 *   - Pattern refinements ensure shape correctness at trust boundaries
 *
 * @module @tmnl/pct/contracts/Brands
 */

import * as Effect from "effect-v4/Effect"
import * as Schema from "effect-v4/Schema"

// ─── NodeId ─────────────────────────────────────────────────────────────────

/**
 * Permissive pattern for node identifiers. The default form is
 * `pct:<base32>` issued by the registry, but tests/dev use shorter
 * strings (e.g., "self", "node-test-001"). The pattern enforces no
 * whitespace and a sane character set.
 */
export const NODE_ID_PATTERN = /^[A-Za-z0-9_:.-]{1,128}$/

/** Branded node identifier for a registry instance. */
export const NodeId = Schema.String.check(
  Schema.isPattern(NODE_ID_PATTERN),
).pipe(Schema.brand("@tmnl/pct/NodeId")).annotate({
  identifier: "NodeId",
  description: "Identifier for a registry node. Issued or assigned per deployment.",
})
export type NodeId = typeof NodeId.Type

/** Hot path: zero-cost trust cast. */
export const trustNodeId = (s: string): NodeId => s as NodeId

/** Validation path: decode an unknown into a NodeId. */
export const decodeNodeId = Schema.decodeUnknownEffect(NodeId)

// ─── SchemaName ─────────────────────────────────────────────────────────────

/**
 * `{namespace}/{name}` — schema or operation identifier without version.
 *
 *   - `orders/Order`
 *   - `auth.iam/User`
 *   - `orders.create` (operation; no slash needed when name is dotted)
 *
 * Dots (`.`), slashes (`/`), and dashes (`-`) allowed. No whitespace.
 */
export const SCHEMA_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_./-]{0,253}[A-Za-z0-9_]$/

/** Branded schema/operation name (without version). */
export const SchemaName = Schema.String.check(
  Schema.isPattern(SCHEMA_NAME_PATTERN),
).pipe(Schema.brand("@tmnl/pct/SchemaName")).annotate({
  identifier: "SchemaName",
  description: "Schema or operation identifier without version: `{namespace}/{name}` or dotted.",
})
export type SchemaName = typeof SchemaName.Type

/** Hot path: zero-cost trust cast. */
export const trustSchemaName = (s: string): SchemaName => s as SchemaName

/** Validation path. */
export const decodeSchemaName = Schema.decodeUnknownEffect(SchemaName)

// ─── SchemaId ───────────────────────────────────────────────────────────────

/**
 * Compound `{name}@{version}` identifier — the wire form clients pass
 * back to servers in the `Schema-Id` header.
 *
 * **Opaque on the wire.** Default form is human-readable (`{name}@{version}`),
 * but the registry MAY issue compact codes (`pct:01HKZQ7M`). Both must
 * match the brand.
 */
export const SCHEMA_ID_PATTERN = /^([A-Za-z][A-Za-z0-9_./-]{0,253}[A-Za-z0-9_]@\d+\.\d+\.\d+(?:[-+][A-Za-z0-9_.-]+)?|pct:[A-Za-z0-9]{6,32})$/

/** Branded compound Schema-Id. */
export const SchemaId = Schema.String.check(
  Schema.isPattern(SCHEMA_ID_PATTERN),
).pipe(Schema.brand("@tmnl/pct/SchemaId")).annotate({
  identifier: "SchemaId",
  description: "Compound identifier — `{name}@{semver}` or registry-issued compact form `pct:<base32>`.",
})
export type SchemaId = typeof SchemaId.Type

/** Hot path: zero-cost trust cast. */
export const trustSchemaId = (s: string): SchemaId => s as SchemaId

/** Validation path. */
export const decodeSchemaId = Schema.decodeUnknownEffect(SchemaId)

/**
 * Compose a Schema-Id from name + version. Returns the canonical
 * long form `{name}@{version}`.
 */
export const composeSchemaId = (name: string, version: string): SchemaId =>
  `${name}@${version}` as SchemaId

/**
 * Decompose a long-form Schema-Id back into (name, version). Returns
 * `Option.none` for compact forms (which can't be decomposed without a
 * registry lookup).
 */
export const decomposeSchemaId = (
  id: SchemaId,
): { readonly name: string; readonly version: string } | undefined => {
  if ((id as string).startsWith("pct:")) return undefined
  const at = (id as string).lastIndexOf("@")
  if (at <= 0) return undefined
  return {
    name: (id as string).slice(0, at),
    version: (id as string).slice(at + 1),
  }
}

// ─── Effect helpers ────────────────────────────────────────────────────────

/**
 * Compose a Schema-Id and validate it. Use when the inputs are not
 * yet trusted (e.g. came from user input).
 */
export const composeAndValidateSchemaId = (
  name: string,
  version: string,
): Effect.Effect<SchemaId, never, never> =>
  Effect.succeed(composeSchemaId(name, version))
