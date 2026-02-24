import { Context, Effect, Layer, Schema } from 'effect'
import { PgClient } from '@effect/sql-pg'
import {
  SourceRegistryEntry,
  type SourceRegistryEntry as SourceRegistryEntryType,
} from '../../registry/schemas'

export class RegistrySourceRepositoryError extends Schema.TaggedError<RegistrySourceRepositoryError>()(
  'RegistrySourceRepositoryError',
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const RegistryTaxonomyRow = Schema.Struct({
  canonical_source: Schema.String,
  domain: Schema.String,
  modality: Schema.String,
  description: Schema.String,
  active: Schema.Boolean,
})
export type RegistryTaxonomyRow = typeof RegistryTaxonomyRow.Type

export const RegistrySourceRow = Schema.Struct({
  source_id: Schema.String,
  version: Schema.String,
  canonical_source: Schema.String,
  display_name: Schema.String,
  endpoint: Schema.String,
  enabled: Schema.Boolean,
  role: Schema.String,
  priority: Schema.Number,
  weight: Schema.Number,
  capabilities: Schema.Unknown,
  metadata: Schema.Unknown,
})
export type RegistrySourceRow = typeof RegistrySourceRow.Type

export const RegistryAliasRow = Schema.Struct({
  source_id: Schema.String,
  adapter: Schema.String,
  external_id: Schema.String,
  canonical_source: Schema.String,
})
export type RegistryAliasRow = typeof RegistryAliasRow.Type

const decodeTaxonomyRows = Schema.decodeUnknownSync(Schema.Array(RegistryTaxonomyRow))
const decodeSourceRows = Schema.decodeUnknownSync(Schema.Array(RegistrySourceRow))
const decodeAliasRows = Schema.decodeUnknownSync(Schema.Array(RegistryAliasRow))
const decodeSourceRegistryEntry = Schema.decodeUnknownSync(SourceRegistryEntry)

export const buildSourceRegistryEntries = (
  sources: ReadonlyArray<RegistrySourceRow>,
  aliases: ReadonlyArray<RegistryAliasRow>
): ReadonlyArray<SourceRegistryEntryType> => {
  const aliasMap = new Map<string, RegistryAliasRow[]>()

  for (const alias of aliases) {
    const bucket = aliasMap.get(alias.source_id)
    if (bucket) {
      bucket.push(alias)
    } else {
      aliasMap.set(alias.source_id, [alias])
    }
  }

  return sources
    .map((source) => {
      const sourceAliases = aliasMap.get(source.source_id) ?? []

      return decodeSourceRegistryEntry({
        _tag: 'SourceRegistryEntry',
        version: source.version,
        sourceId: source.source_id,
        canonicalSource: source.canonical_source,
        displayName: source.display_name,
        endpoint: source.endpoint,
        enabled: source.enabled,
        role: source.role,
        priority: source.priority,
        weight: source.weight,
        aliases: sourceAliases.map((alias) => ({
          adapter: alias.adapter,
          externalId: alias.external_id,
          canonical: alias.canonical_source,
        })),
        capabilities: source.capabilities,
        metadata: source.metadata,
      })
    })
    .sort((a, b) => b.priority - a.priority)
}

export interface RegistrySourceRepository {
  readonly listTaxonomy: () => Effect.Effect<ReadonlyArray<RegistryTaxonomyRow>, RegistrySourceRepositoryError>
  readonly listSources: () => Effect.Effect<ReadonlyArray<RegistrySourceRow>, RegistrySourceRepositoryError>
  readonly listAliases: () => Effect.Effect<ReadonlyArray<RegistryAliasRow>, RegistrySourceRepositoryError>
  readonly listSourceEntries: () => Effect.Effect<ReadonlyArray<SourceRegistryEntryType>, RegistrySourceRepositoryError>
}

export class RegistrySourceRepositoryTag extends Context.Tag('tmnl/geoint/RegistrySourceRepository')<
  RegistrySourceRepositoryTag,
  RegistrySourceRepository
>() {}

const mapError = (operation: string) =>
  (cause: unknown) =>
    new RegistrySourceRepositoryError({
      operation,
      message: `Registry source repository operation failed: ${operation}`,
      cause,
    })

export const makeRegistrySourceRepository = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  const listTaxonomy: RegistrySourceRepository['listTaxonomy'] = () =>
    Effect.try({
      try: () =>
        sql<{ canonical_source: string; domain: string; modality: string; description: string; active: boolean }>`
          SELECT canonical_source, domain, modality, description, active
          FROM geoint_registry.source_taxonomy
          ORDER BY canonical_source
        `,
      catch: mapError('listTaxonomy'),
    }).pipe(
      Effect.flatten,
      Effect.map((rows) => decodeTaxonomyRows(rows)),
      Effect.mapError(mapError('decodeTaxonomyRows'))
    )

  const listSources: RegistrySourceRepository['listSources'] = () =>
    Effect.try({
      try: () =>
        sql<{
          source_id: string
          version: string
          canonical_source: string
          display_name: string
          endpoint: string
          enabled: boolean
          role: string
          priority: number
          weight: number
          capabilities: unknown
          metadata: unknown
        }>`
          SELECT source_id, version, canonical_source, display_name, endpoint, enabled, role, priority, weight, capabilities, metadata
          FROM geoint_registry.sources
          ORDER BY priority DESC, source_id
        `,
      catch: mapError('listSources'),
    }).pipe(
      Effect.flatten,
      Effect.map((rows) => decodeSourceRows(rows)),
      Effect.mapError(mapError('decodeSourceRows'))
    )

  const listAliases: RegistrySourceRepository['listAliases'] = () =>
    Effect.try({
      try: () =>
        sql<{
          source_id: string
          adapter: string
          external_id: string
          canonical_source: string
        }>`
          SELECT source_id, adapter, external_id, canonical_source
          FROM geoint_registry.source_aliases
          ORDER BY source_id, adapter, external_id
        `,
      catch: mapError('listAliases'),
    }).pipe(
      Effect.flatten,
      Effect.map((rows) => decodeAliasRows(rows)),
      Effect.mapError(mapError('decodeAliasRows'))
    )

  const listSourceEntries: RegistrySourceRepository['listSourceEntries'] = () =>
    Effect.gen(function* () {
      const sources = yield* listSources()
      const aliases = yield* listAliases()

      return yield* Effect.try({
        try: () => buildSourceRegistryEntries(sources, aliases),
        catch: mapError('buildSourceRegistryEntries'),
      })
    })

  return {
    listTaxonomy,
    listSources,
    listAliases,
    listSourceEntries,
  } satisfies RegistrySourceRepository
})

export const RegistrySourceRepositoryLive = Layer.effect(
  RegistrySourceRepositoryTag,
  makeRegistrySourceRepository
)
