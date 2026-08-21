/**
 * Used / Generated as a SQL walk of components. Graph is a projection.
 * Components remain what systems write. Do not invent a second SoT.
 *
 * @module @gbg/graph/projection
 */

import * as Effect from 'effect/Effect';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import type { SqlError } from 'effect/unstable/sql/SqlError';
import { GraphError } from './errors.js';

export type RelationKind = 'Used' | 'Generated';

export type GraphEdge = {
  readonly activityId: string;
  readonly relation: RelationKind;
  readonly targetId: string;
};

const mapSql = (operation: string) => (cause: SqlError) =>
  new GraphError({ operation, message: cause.message, cause });

/** Activities that Used this entity. */
export const usedBy = (
  sql: SqlClient,
  entityId: string,
): Effect.Effect<ReadonlyArray<string>, GraphError> =>
  Effect.gen(function* () {
    const rows = yield* sql<{ activity_id: string }>`
      SELECT entity_id AS activity_id
      FROM components
      WHERE kind = 'Used'
        AND payload->>'target' = ${entityId}
    `.pipe(Effect.mapError(mapSql('usedBy')));
    return rows.map((row) => row.activity_id);
  });

/** Activities that Generated this entity. */
export const generatedBy = (
  sql: SqlClient,
  entityId: string,
): Effect.Effect<ReadonlyArray<string>, GraphError> =>
  Effect.gen(function* () {
    const rows = yield* sql<{ activity_id: string }>`
      SELECT entity_id AS activity_id
      FROM components
      WHERE kind = 'Generated'
        AND payload->>'target' = ${entityId}
    `.pipe(Effect.mapError(mapSql('generatedBy')));
    return rows.map((row) => row.activity_id);
  });

/** Targets an activity Used. */
export const used = (
  sql: SqlClient,
  activityId: string,
): Effect.Effect<ReadonlyArray<string>, GraphError> =>
  Effect.gen(function* () {
    const rows = yield* sql<{ target_id: string }>`
      SELECT payload->>'target' AS target_id
      FROM components
      WHERE entity_id = ${activityId}
        AND kind = 'Used'
    `.pipe(Effect.mapError(mapSql('used')));
    return rows.flatMap((row) => (row.target_id ? [row.target_id] : []));
  });

/** Targets an activity Generated. */
export const generated = (
  sql: SqlClient,
  activityId: string,
): Effect.Effect<ReadonlyArray<string>, GraphError> =>
  Effect.gen(function* () {
    const rows = yield* sql<{ target_id: string }>`
      SELECT payload->>'target' AS target_id
      FROM components
      WHERE entity_id = ${activityId}
        AND kind = 'Generated'
    `.pipe(Effect.mapError(mapSql('generated')));
    return rows.flatMap((row) => (row.target_id ? [row.target_id] : []));
  });

/** All Used / Generated rows. Projection of components, not a second store. */
export const edges = (sql: SqlClient): Effect.Effect<ReadonlyArray<GraphEdge>, GraphError> =>
  Effect.gen(function* () {
    const rows = yield* sql<{ activity_id: string; kind: string; target_id: string }>`
      SELECT entity_id AS activity_id, kind, payload->>'target' AS target_id
      FROM components
      WHERE kind IN ('Used', 'Generated')
      ORDER BY attached_at ASC
    `.pipe(Effect.mapError(mapSql('edges')));
    return rows.flatMap((row) => {
      if (row.kind !== 'Used' && row.kind !== 'Generated') return [];
      if (!row.target_id) return [];
      return [{ activityId: row.activity_id, relation: row.kind, targetId: row.target_id }];
    });
  });
