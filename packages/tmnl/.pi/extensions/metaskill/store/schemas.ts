/**
 * @module schemas
 *
 * Effect v4 Schema definitions for RLM Store v2.
 * Validates namespaces, keys, and _meta envelopes.
 *
 * Import convention: effect-v4 (npm alias for effect@4.0.0-beta.23)
 */
import * as Schema from "effect-v4/Schema"

// ── Namespace ────────────────────────────────────────────────────

const NAMESPACE_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){0,2}$/
const SYSTEM_PREFIX = "_system"

/**
 * Dot-separated namespace: 1-3 segments, lowercase kebab-case.
 * Examples: "osint", "osint.scans", "osint.scans.mil"
 * Reserved: "_system" prefix for internal use.
 */
export const Namespace = Schema.String.pipe(
  Schema.check(Schema.makeFilter((s: string) =>
    s.startsWith(SYSTEM_PREFIX) || NAMESPACE_PATTERN.test(s)
      ? undefined
      : `Invalid namespace "${s}". Must be 1-3 dot-separated kebab segments (e.g. "domain.category.sub")`
  )),
  Schema.brand("Namespace")
)
export type Namespace = typeof Namespace.Type

/**
 * Check if a namespace is a system namespace.
 */
export const isSystemNamespace = (ns: string): boolean =>
  ns.startsWith(SYSTEM_PREFIX)

/**
 * Match namespace against a glob pattern.
 * Supports trailing * (e.g. "osint.*" matches "osint.scans", "osint.scans.mil")
 */
export const namespaceMatchesGlob = (ns: string, glob: string): boolean => {
  if (glob === "*") return true
  if (!glob.includes("*")) return ns === glob
  const prefix = glob.replace(/\.\*$/, "")
  return ns === prefix || ns.startsWith(prefix + ".")
}

// ── Key Format ───────────────────────────────────────────────────

const TEMPORAL_KEY_PATTERN = /^[a-z][a-z0-9-]*--\d{8}T\d{6}$/
const CANONICAL_KEY_PATTERN = /^[a-z][a-z0-9-]*$/
const KEY_PATTERN = /^[a-z][a-z0-9-]*(--\d{8}T\d{6})?$/

/**
 * Store key: either canonical (plain kebab) or temporal (prefix--YYYYMMDDTHHMMSS).
 */
export const StoreKey = Schema.String.pipe(
  Schema.check(Schema.makeFilter((s: string) =>
    KEY_PATTERN.test(s)
      ? undefined
      : `Invalid key "${s}". Must be kebab-case, optionally --YYYYMMDDTHHMMSS`
  )),
  Schema.brand("StoreKey")
)
export type StoreKey = typeof StoreKey.Type

/**
 * Detect key kind.
 */
export const isTemporalKey = (key: string): boolean => TEMPORAL_KEY_PATTERN.test(key)
export const isCanonicalKey = (key: string): boolean => CANONICAL_KEY_PATTERN.test(key)

/**
 * Generate a temporal key suffix from current time.
 * Format: --YYYYMMDDTHHMMSS
 */
export const temporalSuffix = (): string => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  const h = String(now.getHours()).padStart(2, "0")
  const mi = String(now.getMinutes()).padStart(2, "0")
  const s = String(now.getSeconds()).padStart(2, "0")
  return `--${y}${m}${d}T${h}${mi}${s}`
}

// ── ObjectMeta ───────────────────────────────────────────────────

/**
 * Metadata envelope for stored objects.
 * `summary` is REQUIRED (non-empty string).
 * All other fields are optional/open.
 *
 * We validate summary separately and pass the rest through,
 * because the _meta bag is intentionally open for domain-specific fields.
 */
export const ObjectMetaCore = Schema.Struct({
  summary: Schema.NonEmptyString,
  source: Schema.optional(Schema.String),
  intent: Schema.optional(Schema.String),
  schema: Schema.optional(Schema.String),
})
export type ObjectMetaCore = typeof ObjectMetaCore.Type

/**
 * Runtime validation: check that _meta has at least a non-empty summary.
 * Returns the full _meta object (including unknown fields) on success.
 * Throws on validation failure.
 */
export const validateMeta = (meta: unknown): Record<string, unknown> => {
  if (meta == null || typeof meta !== "object") {
    throw new Error("_meta must be an object with at least { summary: string }")
  }
  const m = meta as Record<string, unknown>
  if (typeof m.summary !== "string" || m.summary.trim().length === 0) {
    throw new Error("_meta.summary is required and must be a non-empty string")
  }
  return m
}

// ── Domain Config ────────────────────────────────────────────────

export const CollectionConfig = Schema.Struct({
  description: Schema.String,
  icon: Schema.optional(Schema.String),
  retention: Schema.optional(Schema.String),
})
export type CollectionConfig = typeof CollectionConfig.Type

export const DomainConfig = Schema.Struct({
  description: Schema.String,
  collections: Schema.Record(Schema.String, CollectionConfig),
  meta: Schema.Struct({
    required: Schema.Array(Schema.String),
    recommended: Schema.optional(Schema.Array(Schema.String)),
  }),
})
export type DomainConfig = typeof DomainConfig.Type

// ── Decode helpers ───────────────────────────────────────────────

const decodeNamespace = Schema.decodeUnknownSync(Namespace)
const decodeStoreKey = Schema.decodeUnknownSync(StoreKey)
const decodeDomainConfig = Schema.decodeUnknownSync(DomainConfig)

/**
 * Validate and brand a namespace string.
 * Throws on invalid format.
 */
export const validateNamespace = (ns: string): Namespace => decodeNamespace(ns)

/**
 * Validate and brand a key string.
 * Throws on invalid format.
 */
export const validateKey = (key: string): StoreKey => decodeStoreKey(key)

/**
 * Validate a domain config.
 * Throws on invalid format.
 */
export const validateDomainConfig = (config: unknown): DomainConfig => decodeDomainConfig(config)
