/**
 * ECS PostgreSQL Schema Migrator
 *
 * Effect-native migrations for the Canonical Entity System.
 * Uses a simplified migration pattern without platform dependencies.
 *
 * Schema Design:
 * - entity.entities: Core entity table with provenance
 * - entity.spatial: Spatial trait (PostGIS PointZ)
 * - entity.temporal: Temporal trait (validity windows)
 * - entity.kinetic: Kinetic trait (heading, speed, vertical rate)
 * - entity.classified: Classification trait
 * - entity.identifiable: External IDs, callsigns
 * - entity.raw_audit: Provenance audit trail
 *
 * @see assets/documents/ecs/architecture/ECS_PERSISTENCE_ARCHITECTURE.md
 * @module ecs/persistence/migrator
 */

import { Effect, Schema } from 'effect'
import { PgClient } from '@effect/sql-pg'
import { SqlClient, SqlError } from '@effect/sql'

// =============================================================================
// Types
// =============================================================================

/**
 * Migration definition
 */
interface Migration {
  readonly id: number
  readonly name: string
  readonly up: Effect.Effect<void, SqlError.SqlError, SqlClient.SqlClient>
}

/**
 * Migration error
 */
export class MigrationError extends Schema.TaggedError<MigrationError>()(
  'MigrationError',
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

// =============================================================================
// Migration Definitions
// =============================================================================

const migrations: readonly Migration[] = [
  {
    id: 1,
    name: 'create_entity_schema',
    up: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      yield* sql`CREATE EXTENSION IF NOT EXISTS postgis`
      yield* sql`CREATE SCHEMA IF NOT EXISTS entity`
    }),
  },
  {
    id: 2,
    name: 'create_entities_table',
    up: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      yield* sql`
        CREATE TABLE IF NOT EXISTS entity.entities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_id TEXT NOT NULL UNIQUE,
          entity_type TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          revision INTEGER NOT NULL DEFAULT 1,
          confidence FLOAT NOT NULL DEFAULT 0.5,
          is_stale BOOLEAN NOT NULL DEFAULT false,
          ttl_seconds INTEGER NOT NULL DEFAULT 300,
          provenance JSONB NOT NULL DEFAULT '{"sources": [], "primarySource": null}',
          metadata JSONB NOT NULL DEFAULT '{}'
        )
      `
      yield* sql`CREATE INDEX IF NOT EXISTS idx_entities_entity_id ON entity.entities(entity_id)`
      yield* sql`CREATE INDEX IF NOT EXISTS idx_entities_entity_type ON entity.entities(entity_type)`
      yield* sql`CREATE INDEX IF NOT EXISTS idx_entities_updated_at ON entity.entities(updated_at)`
      yield* sql`CREATE INDEX IF NOT EXISTS idx_entities_is_stale ON entity.entities(is_stale) WHERE is_stale = true`
    }),
  },
  {
    id: 3,
    name: 'create_spatial_table',
    up: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      yield* sql`
        CREATE TABLE IF NOT EXISTS entity.spatial (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_id UUID NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
          position GEOMETRY(PointZ, 4326) NOT NULL,
          bounds BOX2D,
          geometry GEOMETRY(Geometry, 4326),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_spatial_entity UNIQUE (entity_id)
        )
      `
      yield* sql`CREATE INDEX IF NOT EXISTS idx_spatial_position ON entity.spatial USING GIST(position)`
      yield* sql`CREATE INDEX IF NOT EXISTS idx_spatial_geometry ON entity.spatial USING GIST(geometry) WHERE geometry IS NOT NULL`
      yield* sql`CREATE INDEX IF NOT EXISTS idx_spatial_entity_id ON entity.spatial(entity_id)`
    }),
  },
  {
    id: 4,
    name: 'create_temporal_table',
    up: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      yield* sql`
        CREATE TABLE IF NOT EXISTS entity.temporal (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_id UUID NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
          valid_from TIMESTAMPTZ NOT NULL,
          valid_to TIMESTAMPTZ,
          observed_at TIMESTAMPTZ NOT NULL,
          timezone TEXT NOT NULL DEFAULT 'UTC',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_temporal_entity UNIQUE (entity_id)
        )
      `
      yield* sql`CREATE INDEX IF NOT EXISTS idx_temporal_valid_from ON entity.temporal(valid_from)`
      yield* sql`CREATE INDEX IF NOT EXISTS idx_temporal_observed_at ON entity.temporal(observed_at)`
      yield* sql`CREATE INDEX IF NOT EXISTS idx_temporal_entity_id ON entity.temporal(entity_id)`
    }),
  },
  {
    id: 5,
    name: 'create_kinetic_table',
    up: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      yield* sql`
        CREATE TABLE IF NOT EXISTS entity.kinetic (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_id UUID NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
          heading FLOAT NOT NULL,
          speed FLOAT NOT NULL,
          vertical_rate FLOAT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_kinetic_entity UNIQUE (entity_id)
        )
      `
      yield* sql`CREATE INDEX IF NOT EXISTS idx_kinetic_entity_id ON entity.kinetic(entity_id)`
    }),
  },
  {
    id: 6,
    name: 'create_classified_table',
    up: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      yield* sql`
        CREATE TABLE IF NOT EXISTS entity.classified (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_id UUID NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
          classification TEXT NOT NULL DEFAULT 'unknown',
          object_type TEXT NOT NULL,
          allegiance TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_classified_entity UNIQUE (entity_id)
        )
      `
      yield* sql`CREATE INDEX IF NOT EXISTS idx_classified_classification ON entity.classified(classification)`
      yield* sql`CREATE INDEX IF NOT EXISTS idx_classified_object_type ON entity.classified(object_type)`
      yield* sql`CREATE INDEX IF NOT EXISTS idx_classified_entity_id ON entity.classified(entity_id)`
    }),
  },
  {
    id: 7,
    name: 'create_identifiable_table',
    up: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      yield* sql`
        CREATE TABLE IF NOT EXISTS entity.identifiable (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_id UUID NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
          external_ids JSONB NOT NULL DEFAULT '{}',
          callsign TEXT,
          name TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_identifiable_entity UNIQUE (entity_id)
        )
      `
      yield* sql`CREATE INDEX IF NOT EXISTS idx_identifiable_external_ids ON entity.identifiable USING GIN(external_ids)`
      yield* sql`CREATE INDEX IF NOT EXISTS idx_identifiable_callsign ON entity.identifiable(callsign) WHERE callsign IS NOT NULL`
      yield* sql`CREATE INDEX IF NOT EXISTS idx_identifiable_entity_id ON entity.identifiable(entity_id)`
    }),
  },
  {
    id: 8,
    name: 'create_raw_audit_table',
    up: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      yield* sql`
        CREATE TABLE IF NOT EXISTS entity.raw_audit (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_id UUID NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
          source TEXT NOT NULL,
          stream_url TEXT,
          stream_offset TEXT,
          data_hash TEXT NOT NULL,
          ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
      yield* sql`CREATE INDEX IF NOT EXISTS idx_raw_audit_entity_id ON entity.raw_audit(entity_id)`
      yield* sql`CREATE INDEX IF NOT EXISTS idx_raw_audit_source ON entity.raw_audit(source)`
      yield* sql`CREATE INDEX IF NOT EXISTS idx_raw_audit_ingested_at ON entity.raw_audit(ingested_at)`
    }),
  },
]

// =============================================================================
// Migration Runner
// =============================================================================

const MIGRATIONS_TABLE = 'entity._migrations'

/**
 * Ensure the migrations tracking table exists.
 */
const ensureMigrationsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // First ensure entity schema exists
  yield* sql`CREATE SCHEMA IF NOT EXISTS entity`

  yield* sql`
    CREATE TABLE IF NOT EXISTS ${sql(MIGRATIONS_TABLE)} (
      migration_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
})

/**
 * Get the latest applied migration ID.
 */
const getLatestMigrationId = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const result = yield* sql<{ max_id: number | null }>`
    SELECT MAX(migration_id) as max_id FROM ${sql(MIGRATIONS_TABLE)}
  `.pipe(Effect.catchAll(() => Effect.succeed([{ max_id: null }])))

  return result[0]?.max_id ?? 0
})

/**
 * Record a migration as applied.
 */
const recordMigration = (id: number, name: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`
      INSERT INTO ${sql(MIGRATIONS_TABLE)} (migration_id, name)
      VALUES (${id}, ${name})
    `
  })

/**
 * Run all pending migrations.
 */
export const runMigrations = Effect.gen(function* () {
  yield* ensureMigrationsTable

  const latestId = yield* getLatestMigrationId
  yield* Effect.logInfo(`ECS migrations: current version ${latestId}`)

  const pending = migrations.filter((m) => m.id > latestId)

  if (pending.length === 0) {
    yield* Effect.logInfo('ECS migrations: already up to date')
    return []
  }

  yield* Effect.logInfo(`ECS migrations: applying ${pending.length} migrations`)

  const applied: Array<{ id: number; name: string }> = []

  for (const migration of pending) {
    yield* Effect.logInfo(`Applying migration ${migration.id}: ${migration.name}`)

    yield* migration.up.pipe(
      Effect.mapError(
        (e) =>
          new MigrationError({
            operation: `migration_${migration.id}`,
            message: `Failed to apply migration ${migration.id}_${migration.name}: ${e}`,
            cause: e,
          })
      )
    )

    yield* recordMigration(migration.id, migration.name)
    applied.push({ id: migration.id, name: migration.name })

    yield* Effect.logInfo(`Applied migration ${migration.id}: ${migration.name}`)
  }

  yield* Effect.logInfo(`ECS migrations: applied ${applied.length} migrations`)
  return applied
})

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if PostGIS extension is installed.
 */
export const checkPostGIS = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  const result = yield* sql<{ exists: boolean }>`
    SELECT EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'postgis'
    ) as exists
  `.pipe(Effect.catchAll(() => Effect.succeed([{ exists: false }])))

  return result[0]?.exists === true
})

/**
 * Get PostGIS version if installed.
 */
export const getPostGISVersion = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  return yield* sql<{ version: string }>`
    SELECT PostGIS_Version() as version
  `.pipe(
    Effect.map((rows) => rows[0]?.version ?? 'unknown'),
    Effect.catchAll(() => Effect.succeed('not installed'))
  )
})

/**
 * Verify schema integrity.
 */
export const verifySchema = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  const expectedTables = [
    'entities',
    'spatial',
    'temporal',
    'kinetic',
    'classified',
    'identifiable',
    'raw_audit',
  ]

  const results: Array<{ table: string; exists: boolean }> = []

  for (const table of expectedTables) {
    const check = yield* sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'entity' AND table_name = ${table}
      ) as exists
    `.pipe(Effect.catchAll(() => Effect.succeed([{ exists: false }])))

    results.push({ table, exists: check[0]?.exists ?? false })
  }

  const missing = results.filter((r) => !r.exists).map((r) => r.table)

  if (missing.length > 0) {
    yield* Effect.logWarning(`Missing ECS tables: ${missing.join(', ')}`)
    return { valid: false, missing }
  }

  yield* Effect.logInfo('ECS schema verified successfully')
  return { valid: true, missing: [] as string[] }
})

/**
 * Drop all ECS tables (for testing only).
 */
export const dropAllTables = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  yield* Effect.logWarning('Dropping all ECS tables...')

  // Drop in reverse dependency order
  yield* sql`DROP TABLE IF EXISTS entity.raw_audit CASCADE`
  yield* sql`DROP TABLE IF EXISTS entity.identifiable CASCADE`
  yield* sql`DROP TABLE IF EXISTS entity.classified CASCADE`
  yield* sql`DROP TABLE IF EXISTS entity.kinetic CASCADE`
  yield* sql`DROP TABLE IF EXISTS entity.temporal CASCADE`
  yield* sql`DROP TABLE IF EXISTS entity.spatial CASCADE`
  yield* sql`DROP TABLE IF EXISTS entity.entities CASCADE`
  yield* sql`DROP TABLE IF EXISTS entity._migrations CASCADE`
  yield* sql`DROP SCHEMA IF EXISTS entity CASCADE`

  yield* Effect.logInfo('All ECS tables dropped')
})

/**
 * Reset database (drop and recreate).
 */
export const resetDatabase = Effect.gen(function* () {
  yield* dropAllTables
  yield* runMigrations
})
