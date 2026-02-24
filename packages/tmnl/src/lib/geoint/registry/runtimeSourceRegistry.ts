import { Effect, Layer, Schema } from 'effect'
import {
  RegistrySourceRepositoryTag,
  type RegistrySourceRepository,
} from '../persistence/postgis/RegistrySourceRepository'
import {
  listSeededSourceRegistry,
  resetSourceRegistry,
  setSourceRegistry,
} from './sourceRegistry'

export class SourceRegistryHydrationError extends Schema.TaggedError<SourceRegistryHydrationError>()(
  'SourceRegistryHydrationError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const SourceRegistryHydrationResult = Schema.Struct({
  source: Schema.Literal('database', 'seed'),
  sourceCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  fallbackReason: Schema.optional(Schema.String),
})
export type SourceRegistryHydrationResult = typeof SourceRegistryHydrationResult.Type

/**
 * Hydrate the in-memory source registry from DB.
 * Falls back to seeded registry if DB read fails or returns no rows.
 */
export const hydrateSourceRegistryFromDb = Effect.gen(function* () {
  const repo = yield* RegistrySourceRepositoryTag

  const dbEntries = yield* repo.listSourceEntries().pipe(
    Effect.catchAll((error) =>
      Effect.succeed({
        _tag: 'db-error' as const,
        error,
      })
    )
  )

  if (Array.isArray(dbEntries) && dbEntries.length > 0) {
    setSourceRegistry(dbEntries)

    return {
      source: 'database' as const,
      sourceCount: dbEntries.length,
    }
  }

  const fallbackReason = Array.isArray(dbEntries)
    ? 'database returned empty registry set'
    : `database registry load failed: ${String(dbEntries.error)}`

  resetSourceRegistry()

  return {
    source: 'seed' as const,
    sourceCount: listSeededSourceRegistry().length,
    fallbackReason,
  }
}).pipe(
  Effect.mapError((cause) =>
    new SourceRegistryHydrationError({
      message: 'Failed to hydrate source registry',
      cause,
    })
  )
)

export const createHydrationLayerFromRepository = (repository: RegistrySourceRepository) =>
  Layer.succeed(RegistrySourceRepositoryTag, repository)
