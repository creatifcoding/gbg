/**
 * Manifest — a structured snapshot of an instance's recognized
 * schemas and operations.
 *
 * # Schema discipline
 *
 * Per AGENTS.md: domain entities with methods are `Schema.TaggedClass`.
 * Manifest is exactly that — identity (nodeId + revision), defined
 * behavior set (`print`, `encode`, `diffAgainst`), self-describing on
 * the wire (`_tag: "Manifest"` in JSON form).
 *
 * # Effect-typed I/O surfaces
 *
 *   - `encode()`        → Effect with typed SchemaError on failure (default)
 *   - `encodeUnsafe()`  → sync; throws on error
 *   - `Manifest.decode` → Effect-returning; typed errors
 *   - `Manifest.decodeUnsafe` → sync throwing variant
 *
 * # Consistency
 *
 * `fromRegistry` takes ONE atomic registry snapshot via
 * `Registry.snapshot`, then projects schemas/operations/revision/asOf
 * from that single state object. This is stronger than three sequential
 * Ref.gets (which could observe interleaved mutations).
 *
 * # Federation convergence
 *
 * Flow B peers can exchange manifests and replay represented registry
 * facts into the local registry. Flow B+ narrows that to a PCT-native
 * delta envelope. Flow C uses Effect-smol's `EventLogRemote` substrate;
 * the manifest remains the readout rather than the substrate sequence.
 *
 * @module @tmnl/pct/manifest/Manifest
 */

import * as Effect from "effect-v4/Effect"
import * as Schema from "effect-v4/Schema"

import { Registry } from "../registry/Registry.js"
import {
  asOfIso,
  OperationEntry,
  SchemaEntry,
  type RegistryState,
} from "../registry/RegistryState.js"

// ─── Federation peer info (sub-entity) ──────────────────────────────────────

export const PeerInfo = Schema.TaggedStruct("PeerInfo", {
  nodeId: Schema.String,
  url: Schema.String,
  syncStatus: Schema.Literals(["live", "stale", "unreachable"]),
  lastSyncAt: Schema.optional(Schema.Number),
})
export type PeerInfo = typeof PeerInfo.Type

// ─── Construction options ───────────────────────────────────────────────────

export interface FromRegistryOptions {
  readonly nodeId: string
  readonly nodeUrl?: string
  /** Filter out deprecated entries (default: include them). */
  readonly excludeDeprecated?: boolean
}

export interface PrintOptions {
  /** When false, omits deprecated entries from the rendering. */
  readonly includeDeprecated?: boolean
  /** When false, omits the schemaDocument JSON blob (which is large). */
  readonly includeSchemaDocuments?: boolean
}

export interface ManifestDiff {
  readonly schemasAdded: ReadonlyArray<SchemaEntry>
  readonly schemasDeprecated: ReadonlyArray<SchemaEntry>
  readonly schemasRemoved: ReadonlyArray<SchemaEntry>
  readonly operationsAdded: ReadonlyArray<OperationEntry>
  readonly operationsDeprecated: ReadonlyArray<OperationEntry>
  readonly operationsRemoved: ReadonlyArray<OperationEntry>
}

// ─── The Manifest TaggedClass ───────────────────────────────────────────────

/**
 * A snapshot of an instance's recognized schemas and operations.
 *
 * Self-describing on the wire (`_tag: "Manifest"` in JSON form).
 * Construct via `new Manifest({...})` for direct value creation, or
 * `Manifest.fromRegistry(...)` to read the live registry state.
 */
export class Manifest extends Schema.TaggedClass<Manifest>()("Manifest", {
  /** Identifier for the instance this manifest came from. */
  nodeId: Schema.String,
  /** Optional URL where this instance can be reached. */
  nodeUrl: Schema.optional(Schema.String),
  /** Monotonic revision counter at the time of generation. */
  revision: Schema.Number,
  /** ISO-8601 timestamp of the most recent registry mutation. */
  asOf: Schema.NullOr(Schema.String),
  /** All schemas the instance recognizes (live + deprecated). */
  schemas: Schema.Array(SchemaEntry),
  /** All operations the instance recognizes (live + deprecated). */
  operations: Schema.Array(OperationEntry),
  /** Optional federation peer info; populated when federation layer is wired. */
  peers: Schema.optional(Schema.Array(PeerInfo)),
}) {
  // ─── Static factories ────────────────────────────────────────────────────

  /**
   * Read the live registry into a Manifest.
   *
   * Takes one atomic `Registry.snapshot` and projects from it — coherent
   * across schemas, operations, revision, and asOf. Within the returning
   * Effect, the result is consistent regardless of concurrent mutations
   * after the snapshot.
   *
   * Wrapped in `Effect.fn` for traced spans (visible in observability
   * dashboards under `Manifest.fromRegistry`).
   */
  static readonly fromRegistry = Effect.fn("Manifest.fromRegistry")(
    function* (options: FromRegistryOptions) {
      const registry = yield* Registry
      const state = yield* registry.snapshot
      return Manifest.fromState(state, options)
    },
  )

  /**
   * Construct a Manifest from a `RegistryState` snapshot. Pure function;
   * useful for tests, replay, and federation diffing.
   */
  static readonly fromState = (
    state: RegistryState,
    options: FromRegistryOptions,
  ): Manifest => {
    const includeDeprecated = options.excludeDeprecated !== true
    const schemas = filter(Array.from(state.schemas.values()), includeDeprecated)
    const operations = filter(
      Array.from(state.operations.values()),
      includeDeprecated,
    )
    return new Manifest({
      nodeId: options.nodeId,
      ...(options.nodeUrl !== undefined ? { nodeUrl: options.nodeUrl } : {}),
      revision: state.revision,
      asOf: asOfIso(state),
      schemas,
      operations,
    })
  }

  /**
   * Decode a JSON value into a Manifest, returning Effect with a typed
   * `ParseError` on failure. Use for wire/persistence boundaries.
   */
  /**
   * Effect-returning decoder. Inferred error type is Effect v4's
   * `SchemaError` (use `Schema.isSchemaError` to narrow if catching).
   */
  static readonly decode = Schema.decodeUnknownEffect(Manifest)

  /**
   * Sync variant of `decode`. Throws on parse failure. For tests and
   * scripts where you want exceptions, not Effect plumbing.
   */
  static readonly decodeUnsafe = (json: unknown): Manifest =>
    Schema.decodeUnknownSync(Manifest)(json)

  // ─── Instance methods ────────────────────────────────────────────────────

  /**
   * Encode this manifest to a JSON value suitable for HTTP transit or
   * disk persistence. Returns an Effect with typed `ParseError` on
   * failure (e.g., if `schemaDocument` contained non-JSON-serializable
   * payloads — shouldn't happen with conformant registries, but the
   * type system makes the failure path explicit).
   */
  /**
   * Effect-returning encoder. Failures (rare in practice) yield a
   * `SchemaError` in the error channel.
   */
  encode() {
    return Schema.encodeUnknownEffect(Manifest)(this)
  }

  /**
   * Sync variant of `encode`. Throws on encode failure. For tests and
   * scripts where exceptions are acceptable.
   */
  encodeUnsafe(): unknown {
    return Schema.encodeUnknownSync(Manifest)(this)
  }

  /**
   * Render this manifest as human-readable text suitable for CLI output
   * (`pact registry status`, `pact registry list`).
   */
  print(options: PrintOptions = {}): string {
    const includeDeprecated = options.includeDeprecated !== false
    const lines: Array<string> = []

    lines.push(
      `Manifest \u2500 node: ${this.nodeId}${
        this.nodeUrl !== undefined ? ` (${this.nodeUrl})` : ""
      }`,
    )
    lines.push(
      `           revision: ${this.revision}  asOf: ${
        this.asOf ?? "<empty>"
      }`,
    )
    lines.push("")

    const liveSchemas = this.schemas.filter((s) => s.deprecated === null)
    const deprecatedSchemas = this.schemas.filter((s) => s.deprecated !== null)
    const liveOps = this.operations.filter((o) => o.deprecated === null)
    const deprecatedOps = this.operations.filter((o) => o.deprecated !== null)

    // Schemas
    lines.push(
      `Schemas (${liveSchemas.length} live${
        includeDeprecated ? `, ${deprecatedSchemas.length} deprecated` : ""
      }):`,
    )
    for (const s of liveSchemas) {
      lines.push(
        `  \u2713 ${s.schemaId}@${s.version}` +
          `  registered ${formatDate(s.registeredAt)} by ${s.originNodeId}`,
      )
    }
    if (includeDeprecated) {
      for (const s of deprecatedSchemas) {
        const successor = s.deprecated?.successor ?? "<none>"
        lines.push(
          `  \u2298 ${s.schemaId}@${s.version}` +
            `  deprecated ${formatDate(s.deprecated!.at)} \u2192 ${successor}`,
        )
      }
    }
    lines.push("")

    // Operations
    lines.push(
      `Operations (${liveOps.length} live${
        includeDeprecated ? `, ${deprecatedOps.length} deprecated` : ""
      }):`,
    )
    for (const o of liveOps) {
      lines.push(`  \u2713 ${o.name}@${o.version}   ${o.kind}`)
      lines.push(`      in:  ${o.inputSchemaId}`)
      lines.push(`      out: ${o.outputSchemaId}`)
      if (o.errorSchemaIds.length > 0) {
        lines.push(`      err: ${o.errorSchemaIds.join(", ")}`)
      }
    }
    if (includeDeprecated) {
      for (const o of deprecatedOps) {
        const successor = o.deprecated?.successor ?? "<none>"
        lines.push(
          `  \u2298 ${o.name}@${o.version}   ${o.kind}` +
            `  (deprecated \u2192 ${successor})`,
        )
      }
    }

    // Peers (when a served node wires the Federation layer)
    if (this.peers !== undefined && this.peers.length > 0) {
      lines.push("")
      lines.push(`Peers (${this.peers.length}):`)
      for (const p of this.peers) {
        lines.push(
          `  ${syncIcon(p.syncStatus)} ${p.nodeId}  ${p.url}  ` +
            `(${p.syncStatus})`,
        )
      }
    }

    return lines.join("\n")
  }

  /**
   * Compare this manifest against another and report differences.
   *
   * Convention: `this` is the prior state; `other` is the newer.
   *   - "Added"      = present in `other`, absent from `this`.
   *   - "Removed"    = present in `this`, absent from `other`.
   *   - "Deprecated" = both have it; `this.deprecated === null && other.deprecated !== null`.
   */
  diffAgainst(other: Manifest): ManifestDiff {
    return diffManifests(this, other)
  }

  /**
   * Pretty-print a diff against another manifest. Convenience for
   * CLI output: `pact diff <local> <remote>`.
   */
  diffPrint(other: Manifest): string {
    const d = this.diffAgainst(other)
    const lines: Array<string> = []
    const tag = (n: number, label: string) =>
      n === 0 ? "" : `${n} ${label}`
    const summary = [
      tag(d.schemasAdded.length, "schemas added"),
      tag(d.schemasDeprecated.length, "schemas deprecated"),
      tag(d.schemasRemoved.length, "schemas removed"),
      tag(d.operationsAdded.length, "operations added"),
      tag(d.operationsDeprecated.length, "operations deprecated"),
      tag(d.operationsRemoved.length, "operations removed"),
    ]
      .filter((s) => s.length > 0)
      .join(", ")
    lines.push(
      `Diff: ${this.nodeId}@r${this.revision} \u2192 ${other.nodeId}@r${other.revision}`,
    )
    lines.push(summary === "" ? "  (no changes)" : `  ${summary}`)
    for (const s of d.schemasAdded) {
      lines.push(`  + schema   ${s.schemaId}@${s.version}`)
    }
    for (const s of d.schemasDeprecated) {
      lines.push(
        `  \u2298 schema   ${s.schemaId}@${s.version}` +
          ` (\u2192 ${s.deprecated?.successor ?? "<none>"})`,
      )
    }
    for (const s of d.schemasRemoved) {
      lines.push(`  - schema   ${s.schemaId}@${s.version}`)
    }
    for (const o of d.operationsAdded) {
      lines.push(`  + op       ${o.name}@${o.version}   (${o.kind})`)
    }
    for (const o of d.operationsDeprecated) {
      lines.push(
        `  \u2298 op       ${o.name}@${o.version}` +
          ` (\u2192 ${o.deprecated?.successor ?? "<none>"})`,
      )
    }
    for (const o of d.operationsRemoved) {
      lines.push(`  - op       ${o.name}@${o.version}`)
    }
    return lines.join("\n")
  }
}

// ─── Internal helpers ───────────────────────────────────────────────────────

const filter = <
  E extends { readonly deprecated: { readonly at: number } | null },
>(
  entries: ReadonlyArray<E>,
  includeDeprecated: boolean,
): ReadonlyArray<E> =>
  includeDeprecated ? entries : entries.filter((e) => e.deprecated === null)

const formatDate = (epochMs: number): string =>
  new Date(epochMs).toISOString().slice(0, 10)

const syncIcon = (status: "live" | "stale" | "unreachable"): string => {
  switch (status) {
    case "live":
      return "\u25cf"
    case "stale":
      return "\u25d4"
    case "unreachable":
      return "\u25cb"
  }
}

const schemaKey = (s: { schemaId: string; version: string }): string =>
  `${s.schemaId}@${s.version}`
const opKey = (o: { name: string; version: string }): string =>
  `${o.name}@${o.version}`

const diffManifests = (
  before: Manifest,
  after: Manifest,
): ManifestDiff => {
  const beforeSchemaKeys = new Set(before.schemas.map(schemaKey))
  const afterSchemaKeys = new Set(after.schemas.map(schemaKey))
  const beforeOpKeys = new Set(before.operations.map(opKey))
  const afterOpKeys = new Set(after.operations.map(opKey))

  const beforeSchemaIndex = new Map(
    before.schemas.map((s) => [schemaKey(s), s] as const),
  )
  const beforeOpIndex = new Map(
    before.operations.map((o) => [opKey(o), o] as const),
  )

  const schemasAdded = after.schemas.filter(
    (s) => !beforeSchemaKeys.has(schemaKey(s)),
  )
  const schemasRemoved = before.schemas.filter(
    (s) => !afterSchemaKeys.has(schemaKey(s)),
  )
  const schemasDeprecated = after.schemas.filter((s) => {
    const prev = beforeSchemaIndex.get(schemaKey(s))
    return (
      prev !== undefined && prev.deprecated === null && s.deprecated !== null
    )
  })

  const operationsAdded = after.operations.filter(
    (o) => !beforeOpKeys.has(opKey(o)),
  )
  const operationsRemoved = before.operations.filter(
    (o) => !afterOpKeys.has(opKey(o)),
  )
  const operationsDeprecated = after.operations.filter((o) => {
    const prev = beforeOpIndex.get(opKey(o))
    return (
      prev !== undefined && prev.deprecated === null && o.deprecated !== null
    )
  })

  return {
    schemasAdded: schemasAdded as ReadonlyArray<SchemaEntry>,
    schemasDeprecated: schemasDeprecated as ReadonlyArray<SchemaEntry>,
    schemasRemoved: schemasRemoved as ReadonlyArray<SchemaEntry>,
    operationsAdded: operationsAdded as ReadonlyArray<OperationEntry>,
    operationsDeprecated:
      operationsDeprecated as ReadonlyArray<OperationEntry>,
    operationsRemoved: operationsRemoved as ReadonlyArray<OperationEntry>,
  }
}
