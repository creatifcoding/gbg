/**
 * Entity - Core Canonical Entity Model + Repository
 *
 * Co-located definition for the central entity table.
 * Uses Effect Model.Class for database variants and Effect.Service for repository.
 * All queries return Stream.Stream for consistency.
 *
 * @module ecs/entities/Entity
 */

import { Effect, Schema, Stream } from 'effect'
import { Model } from '@effect/sql'
import { SqlClient } from '@effect/sql'
import { SqlError } from '@effect/sql/SqlError'
import { EntityId, EntityType, Confidence } from '../schemas/core'
import { EntityProvenance } from '../schemas/provenance'

// =============================================================================
// Database Types
// =============================================================================

/**
 * UUID for database primary key.
 */
export const EntityUUID = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  Schema.brand('EntityUUID')
)
export type EntityUUID = typeof EntityUUID.Type

/**
 * Provenance stored as JSONB in database.
 */
export const ProvenanceJson = Schema.Struct({
  sources: Schema.Array(Schema.Unknown),
  primarySource: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  revision: Schema.Number,
  aggregateConfidence: Schema.Number,
  isStale: Schema.Boolean,
  ttlSeconds: Schema.Number,
})
export type ProvenanceJson = typeof ProvenanceJson.Type

// =============================================================================
// Model
// =============================================================================

/**
 * Entity Model - Database representation with select/insert/update variants.
 */
export class EntityModel extends Model.Class<EntityModel>('EntityModel')({
  id: Model.Generated(EntityUUID),
  entityId: Schema.String,
  entityType: Schema.String,
  createdAt: Model.DateTimeInsertFromDate,
  updatedAt: Model.DateTimeUpdateFromDate,
  revision: Model.Field({
    select: Schema.Number,
    insert: Schema.optionalWith(Schema.Number, { default: () => 1 }),
    update: Schema.Number,
    json: Schema.Number,
  }),
  confidence: Model.Field({
    select: Schema.Number,
    insert: Schema.optionalWith(Schema.Number, { default: () => 0.5 }),
    update: Schema.Number,
    json: Schema.Number,
  }),
  isStale: Model.Field({
    select: Schema.Boolean,
    insert: Schema.optionalWith(Schema.Boolean, { default: () => false }),
    update: Schema.Boolean,
    json: Schema.Boolean,
  }),
  ttlSeconds: Model.Field({
    select: Schema.Number,
    insert: Schema.optionalWith(Schema.Number, { default: () => 300 }),
    update: Schema.Number,
    json: Schema.Number,
  }),
  provenance: Model.JsonFromString(ProvenanceJson),
  metadata: Model.JsonFromString(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
}) {}

// =============================================================================
// Input Schemas (using existing core schemas)
// =============================================================================

export const EntityInsert = Schema.Struct({
  entityId: EntityId,
  entityType: EntityType,
  confidence: Schema.optionalWith(Confidence, { default: () => 0.5 as Confidence }),
  ttlSeconds: Schema.optionalWith(Schema.Number, { default: () => 300 }),
  provenance: ProvenanceJson,
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
})
export type EntityInsert = typeof EntityInsert.Type

// =============================================================================
// Repository (Stream-native)
// =============================================================================

export class EntityRepository extends Effect.Service<EntityRepository>()('ecs/EntityRepository', {
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    return {
      /**
       * Insert a new entity. Returns Stream of 1 element.
       */
      insert: (input: EntityInsert): Stream.Stream<EntityModel, SqlError> =>
        Stream.fromEffect(
          sql<EntityModel>`
            INSERT INTO entity.entities (entity_id, entity_type, confidence, ttl_seconds, provenance, metadata)
            VALUES (${input.entityId}, ${input.entityType}, ${input.confidence}, ${input.ttlSeconds},
                    ${JSON.stringify(input.provenance)}::jsonb, ${JSON.stringify(input.metadata)}::jsonb)
            RETURNING *
          `.pipe(Effect.map((rows) => rows[0]))
        ),

      /**
       * Update an existing entity. Returns Stream of 1 element.
       */
      update: (id: EntityUUID, updates: Partial<EntityInsert>): Stream.Stream<EntityModel, SqlError> =>
        Stream.fromEffect(
          sql<EntityModel>`
            UPDATE entity.entities SET
              entity_type = COALESCE(${updates.entityType ?? null}, entity_type),
              confidence = COALESCE(${updates.confidence ?? null}, confidence),
              ttl_seconds = COALESCE(${updates.ttlSeconds ?? null}, ttl_seconds),
              revision = revision + 1,
              updated_at = NOW()
            WHERE id = ${id}
            RETURNING *
          `.pipe(Effect.map((rows) => rows[0]))
        ),

      /**
       * Find entity by UUID.
       */
      findById: (id: EntityUUID): Stream.Stream<EntityModel, SqlError> =>
        Stream.fromEffect(sql<EntityModel>`SELECT * FROM entity.entities WHERE id = ${id}`).pipe(
          Stream.flatMap(Stream.fromIterable)
        ),

      /**
       * Find entity by human-readable entity ID.
       */
      findByEntityId: (entityId: EntityId): Stream.Stream<EntityModel, SqlError> =>
        Stream.fromEffect(sql<EntityModel>`SELECT * FROM entity.entities WHERE entity_id = ${entityId}`).pipe(
          Stream.flatMap(Stream.fromIterable)
        ),

      /**
       * Find all entities by type.
       */
      findByType: (entityType: EntityType): Stream.Stream<EntityModel, SqlError> =>
        Stream.fromEffect(
          sql<EntityModel>`SELECT * FROM entity.entities WHERE entity_type = ${entityType} ORDER BY updated_at DESC`
        ).pipe(Stream.flatMap(Stream.fromIterable)),

      /**
       * Find non-stale entities by type.
       */
      findActiveByType: (entityType: EntityType): Stream.Stream<EntityModel, SqlError> =>
        Stream.fromEffect(
          sql<EntityModel>`
            SELECT * FROM entity.entities
            WHERE entity_type = ${entityType} AND is_stale = false
            ORDER BY updated_at DESC
          `
        ).pipe(Stream.flatMap(Stream.fromIterable)),

      /**
       * Find all stale entities.
       */
      findStale: (): Stream.Stream<EntityModel, SqlError> =>
        Stream.fromEffect(
          sql<EntityModel>`SELECT * FROM entity.entities WHERE is_stale = true ORDER BY updated_at ASC`
        ).pipe(Stream.flatMap(Stream.fromIterable)),

      /**
       * Find recently updated entities.
       */
      findUpdatedSince: (since: Date): Stream.Stream<EntityModel, SqlError> =>
        Stream.fromEffect(
          sql<EntityModel>`SELECT * FROM entity.entities WHERE updated_at >= ${since} ORDER BY updated_at DESC`
        ).pipe(Stream.flatMap(Stream.fromIterable)),

      /**
       * Mark entity as stale.
       */
      markStale: (id: EntityUUID): Stream.Stream<void, SqlError> =>
        Stream.fromEffect(
          sql`UPDATE entity.entities SET is_stale = true, updated_at = NOW() WHERE id = ${id}`.pipe(Effect.asVoid)
        ),

      /**
       * Delete entity by UUID.
       */
      delete: (id: EntityUUID): Stream.Stream<void, SqlError> =>
        Stream.fromEffect(sql`DELETE FROM entity.entities WHERE id = ${id}`.pipe(Effect.asVoid)),

      /**
       * Stream all entities.
       */
      streamAll: (): Stream.Stream<EntityModel, SqlError> =>
        Stream.fromEffect(sql<EntityModel>`SELECT * FROM entity.entities ORDER BY updated_at DESC`).pipe(
          Stream.flatMap(Stream.fromIterable)
        ),
    }
  }),
}) {}

export const EntityRepositoryLive = EntityRepository.Default
