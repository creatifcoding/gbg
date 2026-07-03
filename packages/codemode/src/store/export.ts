/**
 * @module export
 *
 * RLM Store Export/Import with Nix-style Profile Overlays.
 * All string formats are Schema-backed.
 *
 * Profile model:
 *   - Exports carry an optional profile name in the manifest
 *   - Imports apply as named layers — objects tagged with _meta.profile
 *   - _system.profiles ledger tracks every named import
 *   - Profiles can be listed, exported by name, diffed, and unapplied
 *
 * Three export formats:
 *   1. JSON dump    — human-readable, git-friendly, selective
 *   2. SQLite copy  — byte-perfect image backup (API layer)
 *   3. Procedures   — just _system.procedures as a shareable bundle
 *
 * Key selection (both export AND import):
 *   - glob:    "effect.*" — filter collections by pattern
 *   - keys:    ["effect.api/filesystem-v4"] — explicit cherry-pick
 *   - keyGlob: "schema*" — pattern match on keys
 *   - profile: "my-profile" — export only objects from this profile
 *   - since:   "my-profile" — export objects added/changed after profile was applied
 *
 * Import modes:
 *   - merge (default) — upsert with provenance tagging
 *   - replace          — clear target collections first, then load
 *
 * Address syntax: "collection/key" (slash separator)
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as Context from "effect/Context"
import { FileSystem } from "effect/FileSystem"
import { RlmStore, type StoredObject } from "./service.js"
import { namespaceMatchesGlob } from "./schemas.js"

// ══════════════════════════════════════════════════════════════════
// §1 Schema Definitions — string formats
// ══════════════════════════════════════════════════════════════════

// ── Address ──────────────────────────────────────────────────────

export const Address = Schema.String.pipe(
  Schema.check(Schema.makeFilter((s: string) =>
    /^[a-z_][a-z0-9._-]*\/[a-z][a-z0-9-]*(--\d{8}T\d{6})?$/.test(s)
      ? undefined
      : `Invalid address "${s}". Must be "collection/key" (e.g. "effect.api/filesystem-v4")`
  )),
  Schema.brand("Address")
)
export type Address = typeof Address.Type

export function parseAddress(addr: string): { collection: string; key: string } | null {
  const idx = addr.indexOf('/')
  if (idx <= 0 || idx === addr.length - 1) return null
  return { collection: addr.slice(0, idx), key: addr.slice(idx + 1) }
}

export function buildAddress(collection: string, key: string): string {
  return `${collection}/${key}`
}

// ── KeyGlob ──────────────────────────────────────────────────────

export const KeyGlob = Schema.String.pipe(
  Schema.check(Schema.makeFilter((s: string) =>
    s.length > 0 && /^[a-z0-9*_-]+$/.test(s)
      ? undefined
      : `Invalid key glob "${s}". Must be lowercase alphanum/dash with optional * wildcard`
  )),
  Schema.brand("KeyGlob")
)
export type KeyGlob = typeof KeyGlob.Type

export function keyMatchesGlob(key: string, glob: string): boolean {
  if (glob === '*') return true
  if (glob.endsWith('*') && !glob.startsWith('*')) {
    return key.startsWith(glob.slice(0, -1))
  }
  if (glob.startsWith('*') && !glob.endsWith('*')) {
    return key.endsWith(glob.slice(1))
  }
  if (glob.startsWith('*') && glob.endsWith('*') && glob.length > 2) {
    return key.includes(glob.slice(1, -1))
  }
  return key === glob
}

// ── Enums ────────────────────────────────────────────────────────

export const ExportFormat = Schema.Literals(['json', 'sqlite', 'procedures'])
export type ExportFormat = typeof ExportFormat.Type

export const ImportMode = Schema.Literals(['merge', 'replace'])
export type ImportMode = typeof ImportMode.Type

// ── Profile Name ─────────────────────────────────────────────────

export const ProfileName = Schema.String.pipe(
  Schema.check(Schema.makeFilter((s: string) =>
    /^[a-z][a-z0-9-]*$/.test(s)
      ? undefined
      : `Invalid profile name "${s}". Must be lowercase kebab-case (e.g. "effect-knowledge")`
  )),
  Schema.brand("ProfileName")
)
export type ProfileName = typeof ProfileName.Type

// ══════════════════════════════════════════════════════════════════
// §2 Schema Definitions — compound types
// ══════════════════════════════════════════════════════════════════

export const ExportOptions = Schema.Struct({
  path: Schema.String,
  glob: Schema.optional(Schema.String),
  format: Schema.optional(ExportFormat),
  pretty: Schema.optional(Schema.Boolean),
  keys: Schema.optional(Schema.Array(Schema.String)),
  keyGlob: Schema.optional(Schema.String),
  /** Name this export — embedded in manifest, used as default profile name on import */
  profile: Schema.optional(Schema.String),
  /** Tool guide manifest entry — embedded in manifest, describes what this export provides */
  manifest: Schema.optional(Schema.String),
  /** Export only objects from this applied profile */
  fromProfile: Schema.optional(Schema.String),
  /** Export objects added/changed after this profile was applied */
  since: Schema.optional(Schema.String),
})
export type ExportOptions = typeof ExportOptions.Type

export const ImportOptions = Schema.Struct({
  path: Schema.String,
  mode: Schema.optional(ImportMode),
  glob: Schema.optional(Schema.String),
  keys: Schema.optional(Schema.Array(Schema.String)),
  keyGlob: Schema.optional(Schema.String),
  /** Profile name for this import. Falls back to manifest.profile, then anonymous. */
  profile: Schema.optional(Schema.String),
  /** Tool guide manifest entry — MANDATORY for named profiles.
   *  What this profile contributes to the system's capabilities.
   *  Example: "Effect v4 API patterns, gotchas, and schema reference" */
  manifest: Schema.optional(Schema.String),
})
export type ImportOptions = typeof ImportOptions.Type

export const ExportedObject = Schema.Struct({
  collection: Schema.String,
  key: Schema.String,
  data: Schema.Unknown,
  tags: Schema.Array(Schema.String),
})
export type ExportedObject = typeof ExportedObject.Type

export const ExportManifest = Schema.Struct({
  version: Schema.Literal(1),
  format: Schema.Literal('rlm-json'),
  exportedAt: Schema.String,
  glob: Schema.NullOr(Schema.String),
  /** Profile name — embedded at export time, used as default on import */
  profile: Schema.optional(Schema.NullOr(Schema.String)),
  /** Tool guide manifest entry — travels with the profile */
  manifest: Schema.optional(Schema.NullOr(Schema.String)),
  collections: Schema.Array(Schema.String),
  objectCount: Schema.Number,
  objects: Schema.Array(ExportedObject),
})
export type ExportManifest = typeof ExportManifest.Type

export const ImportResult = Schema.Struct({
  mode: ImportMode,
  profile: Schema.NullOr(Schema.String),
  collectionsAffected: Schema.Array(Schema.String),
  objectsImported: Schema.Number,
  objectsSkipped: Schema.Number,
  collectionsCleared: Schema.Number,
})
export type ImportResult = typeof ImportResult.Type

/** Profile ledger entry — stored in _system.profiles */
export const ProfileRecord = Schema.Struct({
  name: Schema.String,
  /** Tool guide manifest entry — MANDATORY. What this profile contributes. */
  manifest: Schema.String,
  appliedAt: Schema.String,
  sourcePath: Schema.String,
  mode: ImportMode,
  objectCount: Schema.Number,
  /** Addresses of every object this profile imported */
  objects: Schema.Array(Schema.String),
  collectionsAffected: Schema.Array(Schema.String),
})
export type ProfileRecord = typeof ProfileRecord.Type

/** Profile listing entry — returned by listProfiles */
export const ProfileSummary = Schema.Struct({
  name: Schema.String,
  manifest: Schema.String,
  appliedAt: Schema.String,
  objectCount: Schema.Number,
  collectionsAffected: Schema.Array(Schema.String),
})
export type ProfileSummary = typeof ProfileSummary.Type

// ══════════════════════════════════════════════════════════════════
// §3 Filtering Logic
// ══════════════════════════════════════════════════════════════════

function matchesKeyFilter(
  collection: string,
  key: string,
  filter: { keys?: readonly string[]; keyGlob?: string },
): boolean {
  const hasKeys = filter.keys && filter.keys.length > 0
  const hasKeyGlob = !!filter.keyGlob
  if (!hasKeys && !hasKeyGlob) return true
  if (hasKeys) {
    const addr = buildAddress(collection, key)
    if ((filter.keys as string[]).includes(addr)) return true
  }
  if (hasKeyGlob) {
    if (keyMatchesGlob(key, filter.keyGlob!)) return true
  }
  return false
}

// ══════════════════════════════════════════════════════════════════
// §4 Service Definition
// ══════════════════════════════════════════════════════════════════

const PROFILES_NS = '_system.profiles'

export interface ExportServiceShape {
  readonly exportStore: (opts: ExportOptions) => Effect.Effect<ExportManifest, Error>
  readonly importStore: (opts: ImportOptions) => Effect.Effect<ImportResult, Error>
  readonly listProfiles: () => Effect.Effect<ProfileSummary[], Error>
  readonly removeProfile: (name: string) => Effect.Effect<{ removed: number; collections: string[] }, Error>
}

export class ExportService extends Context.Service<ExportService, ExportServiceShape>()(
  "@tmnl/rlm/ExportService"
) {}

// ══════════════════════════════════════════════════════════════════
// §5 Service Implementation
// ══════════════════════════════════════════════════════════════════

export const ExportServiceLive = Layer.effect(
  ExportService,
  Effect.gen(function*() {
    const store = yield* RlmStore
    const fs = yield* FileSystem

    // ── Helpers ────────────────────────────────────────────

    /** Get profile record by name from ledger */
    const getProfileRecord = (name: string) =>
      Effect.gen(function*() {
        const items = yield* store.query(PROFILES_NS)
        return items.find(i => i.key === name) ?? null
      })

    /** Check if an object carries _meta.profile matching a name */
    const objectHasProfile = (data: unknown, profileName: string): boolean => {
      if (typeof data !== 'object' || data === null) return false
      const meta = (data as Record<string, unknown>)._meta
      if (typeof meta !== 'object' || meta === null) return false
      return (meta as Record<string, unknown>).profile === profileName
    }

    return ExportService.of({
      // ── Export ──────────────────────────────────────────────

      exportStore: (opts) => Effect.gen(function*() {
        const format = opts.format ?? 'json'
        const glob = opts.glob ?? null
        const profileName = opts.profile ?? null

        if (format === 'sqlite') {
          return yield* Effect.fail(new Error(
            'SQLite export is handled at the API layer (needs db path). Use format: "json" or "procedures".'
          ))
        }

        const effectiveGlob = format === 'procedures' ? '_system.procedures' : glob

        // ── Resolve fromProfile: restrict to objects this profile imported
        let fromProfileAddresses: Set<string> | null = null
        if (opts.fromProfile) {
          const rec = yield* getProfileRecord(opts.fromProfile)
          if (!rec) {
            return yield* Effect.fail(new Error(`Profile "${opts.fromProfile}" not found`))
          }
          const data = rec.data as ProfileRecord
          fromProfileAddresses = new Set(data.objects)
        }

        // ── Resolve since: restrict to objects newer than profile's appliedAt
        let sinceTimestamp: string | null = null
        if (opts.since) {
          const rec = yield* getProfileRecord(opts.since)
          if (!rec) {
            return yield* Effect.fail(new Error(`Profile "${opts.since}" not found`))
          }
          sinceTimestamp = (rec.data as ProfileRecord).appliedAt
        }

        // ── Determine target collections
        let targetCollectionNames: string[]

        if (fromProfileAddresses) {
          // Derive from profile's object manifest
          const colSet = new Set<string>()
          for (const addr of fromProfileAddresses) {
            const parsed = parseAddress(addr)
            if (parsed) colSet.add(parsed.collection)
          }
          targetCollectionNames = [...colSet]
        } else if (opts.keys && opts.keys.length > 0 && !effectiveGlob) {
          const colSet = new Set<string>()
          for (const addr of opts.keys) {
            const parsed = parseAddress(addr)
            if (parsed) colSet.add(parsed.collection)
          }
          targetCollectionNames = [...colSet]
        } else {
          const allCollections = yield* store.collections()
          const filtered = effectiveGlob
            ? allCollections.filter(c => namespaceMatchesGlob(c.name, effectiveGlob))
            : allCollections
          targetCollectionNames = filtered.map(c => c.name)
        }

        // ── Gather objects, applying all filters
        const objects: ExportedObject[] = []
        for (const colName of targetCollectionNames) {
          const items: readonly StoredObject[] = yield* store.query(colName)
          for (const item of items) {
            // Key-level filter
            if (!matchesKeyFilter(item.collection, item.key, opts)) continue

            // fromProfile filter: object address must be in profile manifest
            if (fromProfileAddresses) {
              const addr = buildAddress(item.collection, item.key)
              if (!fromProfileAddresses.has(addr)) continue
            }

            // since filter: object must have been updated after the profile's timestamp
            // Normalize: SQLite uses "YYYY-MM-DD HH:MM:SS", profiles use ISO "YYYY-MM-DDTHH:MM:SS.sssZ"
            if (sinceTimestamp && item.updated_at) {
              const itemTime = item.updated_at.replace(' ', 'T') + (item.updated_at.includes('T') ? '' : 'Z')
              const sinceTime = sinceTimestamp.replace(' ', 'T')
              if (itemTime <= sinceTime) continue
            }

            objects.push({
              collection: item.collection,
              key: item.key,
              data: item.data,
              tags: item.tags as string[],
            })
          }
        }

        const manifest: ExportManifest = {
          version: 1,
          format: 'rlm-json',
          exportedAt: new Date().toISOString(),
          glob: effectiveGlob,
          profile: profileName,
          manifest: opts.manifest ?? null,
          collections: [...new Set(objects.map(o => o.collection))],
          objectCount: objects.length,
          objects,
        }

        const json = opts.pretty !== false
          ? JSON.stringify(manifest, null, 2)
          : JSON.stringify(manifest)

        yield* fs.writeFileString(opts.path, json)
        return manifest
      }),

      // ── Import ─────────────────────────────────────────────

      importStore: (opts) => Effect.gen(function*() {
        const mode = opts.mode ?? 'merge'

        const content = yield* fs.readFileString(opts.path)
        const raw = JSON.parse(content)
        const manifest = Schema.decodeUnknownSync(ExportManifest)(raw)

        // Profile name: explicit opt > manifest.profile > anonymous (null)
        const profileName = opts.profile ?? manifest.profile ?? null

        // Manifest entry: explicit opt > manifest file > auto-generate for named profiles
        const profileManifest = opts.manifest
          ?? manifest.manifest
          ?? (profileName ? `[${profileName}] ${manifest.objectCount} objects from ${manifest.collections.join(', ')}` : null)

        // Filter objects by key/glob/collection filters
        const filteredObjects = manifest.objects.filter(obj => {
          if (opts.glob && !namespaceMatchesGlob(obj.collection, opts.glob)) return false
          return matchesKeyFilter(obj.collection, obj.key, opts)
        })

        const affectedCollections = new Set<string>()
        for (const obj of filteredObjects) {
          affectedCollections.add(obj.collection)
        }

        let imported = 0
        let skipped = manifest.objects.length - filteredObjects.length
        let cleared = 0

        if (mode === 'replace') {
          for (const colName of affectedCollections) {
            yield* store.clear(colName)
            cleared++
          }
        }

        const importedAddresses: string[] = []

        for (const obj of filteredObjects) {
          try {
            // Inject _meta.profile provenance if this is a named import
            let data = obj.data as Record<string, unknown>
            if (profileName) {
              const existingMeta = (typeof data._meta === 'object' && data._meta !== null)
                ? data._meta as Record<string, unknown>
                : {}
              // _meta.summary is required by the store — preserve existing or generate one
              const summary = (existingMeta.summary as string) ||
                `[profile:${profileName}] ${obj.collection}/${obj.key}`
              data = {
                ...data,
                _meta: { ...existingMeta, summary, profile: profileName },
              }
            }

            yield* store.put(
              obj.collection,
              obj.key,
              data,
              obj.tags.length > 0 ? { tags: obj.tags } : undefined
            )
            importedAddresses.push(buildAddress(obj.collection, obj.key))
            imported++
          } catch {
            skipped++
          }
        }

        // ── Record profile in ledger (if named)
        if (profileName && imported > 0) {
          const record: ProfileRecord = {
            name: profileName,
            manifest: profileManifest!,
            appliedAt: new Date().toISOString(),
            sourcePath: opts.path,
            mode,
            objectCount: imported,
            objects: importedAddresses,
            collectionsAffected: [...affectedCollections],
          }
          const ledgerData = {
            ...record,
            _meta: {
              summary: `[profile] ${profileName} — ${imported} objects from ${opts.path}`,
              source: 'export-service',
              type: 'profile',
            },
          }
          yield* store.put(PROFILES_NS, profileName, ledgerData as unknown as Record<string, unknown>, {
            tags: ['profile', profileName],
          })
        }

        return {
          mode,
          profile: profileName,
          collectionsAffected: [...affectedCollections],
          objectsImported: imported,
          objectsSkipped: skipped,
          collectionsCleared: cleared,
        } satisfies ImportResult
      }),

      // ── List Profiles ──────────────────────────────────────

      listProfiles: () => Effect.gen(function*() {
        const items = yield* store.query(PROFILES_NS)
        return items.map(item => {
          const data = item.data as ProfileRecord
          return {
            name: data.name,
            manifest: data.manifest ?? `[${data.name}] ${data.objectCount} objects`,
            appliedAt: data.appliedAt,
            objectCount: data.objectCount,
            collectionsAffected: data.collectionsAffected,
          } satisfies ProfileSummary
        })
      }),

      // ── Remove Profile ─────────────────────────────────────

      removeProfile: (name) => Effect.gen(function*() {
        const rec = yield* getProfileRecord(name)
        if (!rec) {
          return yield* Effect.fail(new Error(`Profile "${name}" not found`))
        }
        const data = rec.data as ProfileRecord

        let removed = 0
        const touchedCollections = new Set<string>()

        // Delete each object this profile imported
        for (const addr of data.objects) {
          const parsed = parseAddress(addr)
          if (!parsed) continue

          // Only delete if the object still carries this profile's provenance
          // Use getRaw — get() strips _meta, but we need to check _meta.profile
          const current = yield* store.getRaw(parsed.collection, parsed.key)
          if (current && objectHasProfile(current, name)) {
            yield* store.del(parsed.collection, parsed.key)
            touchedCollections.add(parsed.collection)
            removed++
          }
        }

        // Remove ledger entry
        yield* store.del(PROFILES_NS, name)

        return { removed, collections: [...touchedCollections] }
      }),
    })
  })
)
