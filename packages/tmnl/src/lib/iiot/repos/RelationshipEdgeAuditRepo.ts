/**
 * RelationshipEdgeAuditRepo — query surface for relationship edge audit trail.
 *
 * Writes are owned by GraphClient relationship mutations. This repository is
 * read-only and exposes typed compliance/diagnostic queries over
 * `iiot.relationship_edge_audit`.
 *
 * @module
 */

import { Context, Effect, Layer, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import {
  RelationshipEdgeAuditEntry,
  type RelationshipEdgeAuditQuery,
  type RelationshipEdgeType,
  type RelationshipNodeType,
} from '../schemas/relationships'
import { decodeRows } from './_decode'

export type RelationshipEdgeAuditRepoError = SqlError.SqlError | ParseResult.ParseError

export interface RelationshipEdgeAuditRepository {
  readonly findByEdgeId: (edgeId: string, limit?: number) => Effect.Effect<readonly RelationshipEdgeAuditEntry[], RelationshipEdgeAuditRepoError>
  readonly findBySource: (input: {
    readonly sourceType: RelationshipNodeType
    readonly sourceId: string
    readonly limit?: number
  }) => Effect.Effect<readonly RelationshipEdgeAuditEntry[], RelationshipEdgeAuditRepoError>
  readonly findByTarget: (input: {
    readonly targetType: RelationshipNodeType
    readonly targetId: string
    readonly limit?: number
  }) => Effect.Effect<readonly RelationshipEdgeAuditEntry[], RelationshipEdgeAuditRepoError>
  readonly search: (query: RelationshipEdgeAuditQuery) => Effect.Effect<readonly RelationshipEdgeAuditEntry[], RelationshipEdgeAuditRepoError>
}

export class RelationshipEdgeAuditRepo extends Context.Tag('iiot/RelationshipEdgeAuditRepo')<
  RelationshipEdgeAuditRepo,
  RelationshipEdgeAuditRepository
>() {}

const decodeAuditRows = decodeRows(RelationshipEdgeAuditEntry)

const defaultLimit = (limit: number | undefined): number => Math.min(Math.max(limit ?? 100, 1), 500)

export const RelationshipEdgeAuditRepoLive = Layer.effect(
  RelationshipEdgeAuditRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const findByEdgeId = (edgeId: string, limit?: number) =>
      sql<unknown>`
        SELECT
          id,
          edge_id AS "edgeId",
          action,
          edge_type AS "edgeType",
          source_type AS "sourceType",
          source_id AS "sourceId",
          target_type AS "targetType",
          target_id AS "targetId",
          actor,
          reason,
          descriptor_version AS "descriptorVersion",
          valid_from AS "validFrom",
          valid_to AS "validTo",
          metadata,
          created_at AS "createdAt"
        FROM iiot.relationship_edge_audit
        WHERE edge_id = ${edgeId}
        ORDER BY created_at DESC
        LIMIT ${defaultLimit(limit)}
      `.pipe(Effect.flatMap(decodeAuditRows))

    const findBySource = (input: {
      readonly sourceType: RelationshipNodeType
      readonly sourceId: string
      readonly limit?: number
    }) =>
      sql<unknown>`
        SELECT
          id,
          edge_id AS "edgeId",
          action,
          edge_type AS "edgeType",
          source_type AS "sourceType",
          source_id AS "sourceId",
          target_type AS "targetType",
          target_id AS "targetId",
          actor,
          reason,
          descriptor_version AS "descriptorVersion",
          valid_from AS "validFrom",
          valid_to AS "validTo",
          metadata,
          created_at AS "createdAt"
        FROM iiot.relationship_edge_audit
        WHERE source_type = ${input.sourceType}
          AND source_id = ${input.sourceId}
        ORDER BY created_at DESC
        LIMIT ${defaultLimit(input.limit)}
      `.pipe(Effect.flatMap(decodeAuditRows))

    const findByTarget = (input: {
      readonly targetType: RelationshipNodeType
      readonly targetId: string
      readonly limit?: number
    }) =>
      sql<unknown>`
        SELECT
          id,
          edge_id AS "edgeId",
          action,
          edge_type AS "edgeType",
          source_type AS "sourceType",
          source_id AS "sourceId",
          target_type AS "targetType",
          target_id AS "targetId",
          actor,
          reason,
          descriptor_version AS "descriptorVersion",
          valid_from AS "validFrom",
          valid_to AS "validTo",
          metadata,
          created_at AS "createdAt"
        FROM iiot.relationship_edge_audit
        WHERE target_type = ${input.targetType}
          AND target_id = ${input.targetId}
        ORDER BY created_at DESC
        LIMIT ${defaultLimit(input.limit)}
      `.pipe(Effect.flatMap(decodeAuditRows))

    const search = (query: RelationshipEdgeAuditQuery) =>
      sql<unknown>`
        SELECT
          id,
          edge_id AS "edgeId",
          action,
          edge_type AS "edgeType",
          source_type AS "sourceType",
          source_id AS "sourceId",
          target_type AS "targetType",
          target_id AS "targetId",
          actor,
          reason,
          descriptor_version AS "descriptorVersion",
          valid_from AS "validFrom",
          valid_to AS "validTo",
          metadata,
          created_at AS "createdAt"
        FROM iiot.relationship_edge_audit
        WHERE (${query.edgeId ?? null}::text IS NULL OR edge_id = ${query.edgeId ?? null})
          AND (${query.edgeType ?? null}::text IS NULL OR edge_type = ${query.edgeType ?? null})
          AND (${query.sourceType ?? null}::text IS NULL OR source_type = ${query.sourceType ?? null})
          AND (${query.sourceId ?? null}::text IS NULL OR source_id = ${query.sourceId ?? null})
          AND (${query.targetType ?? null}::text IS NULL OR target_type = ${query.targetType ?? null})
          AND (${query.targetId ?? null}::text IS NULL OR target_id = ${query.targetId ?? null})
          AND (${query.action ?? null}::text IS NULL OR action = ${query.action ?? null})
        ORDER BY created_at DESC
        LIMIT ${defaultLimit(query.limit)}
      `.pipe(Effect.flatMap(decodeAuditRows))

    return RelationshipEdgeAuditRepo.of({
      findByEdgeId,
      findBySource,
      findByTarget,
      search,
    })
  }),
)

export const RelationshipEdgeAuditRepoInMemory = (entries: readonly RelationshipEdgeAuditEntry[] = []) =>
  Layer.succeed(RelationshipEdgeAuditRepo, RelationshipEdgeAuditRepo.of({
    findByEdgeId: (edgeId, limit) => Effect.succeed(
      entries.filter((entry) => entry.edgeId === edgeId).slice(0, defaultLimit(limit)),
    ),
    findBySource: (input) => Effect.succeed(
      entries
        .filter((entry) => entry.sourceType === input.sourceType && entry.sourceId === input.sourceId)
        .slice(0, defaultLimit(input.limit)),
    ),
    findByTarget: (input) => Effect.succeed(
      entries
        .filter((entry) => entry.targetType === input.targetType && entry.targetId === input.targetId)
        .slice(0, defaultLimit(input.limit)),
    ),
    search: (query) => Effect.succeed(entries.filter((entry) => {
      if (query.edgeId !== undefined && entry.edgeId !== query.edgeId) return false
      if (query.edgeType !== undefined && entry.edgeType !== query.edgeType) return false
      if (query.sourceType !== undefined && entry.sourceType !== query.sourceType) return false
      if (query.sourceId !== undefined && entry.sourceId !== query.sourceId) return false
      if (query.targetType !== undefined && entry.targetType !== query.targetType) return false
      if (query.targetId !== undefined && entry.targetId !== query.targetId) return false
      if (query.action !== undefined && entry.action !== query.action) return false
      return true
    }).slice(0, defaultLimit(query.limit))),
  }))
