/**
 * Bind the Used/Generated projection to Apache AGE when the extension exists.
 * AGE is not a second SoT. Image comes from packages/specimendb/docker (#94).
 *
 * @module @gbg/graph/age
 */

import * as Effect from 'effect/Effect';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import type { SqlError } from 'effect/unstable/sql/SqlError';
import { GraphError } from './errors.js';
import { edges } from './projection.js';

export const GRAPH_NAME = 'lab_catalog';

const mapSql = (operation: string) => (cause: SqlError) =>
  new GraphError({ operation, message: cause.message, cause });

const escapeCypher = (value: string): string => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export const ageAvailable = (sql: SqlClient): Effect.Effect<boolean, GraphError> =>
  Effect.gen(function* () {
    const rows = yield* sql<{ extname: string }>`
      SELECT extname FROM pg_extension WHERE extname = 'age'
    `.pipe(Effect.mapError(mapSql('ageAvailable')));
    return rows.length > 0;
  });

const setSearchPath = (sql: SqlClient) =>
  sql.unsafe(`SET search_path = ag_catalog, "$user", public`).pipe(
    Effect.mapError(mapSql('setSearchPath')),
    Effect.asVoid,
  );

const ensureGraph = (sql: SqlClient) =>
  sql.unsafe(`SELECT create_graph('${GRAPH_NAME}')`).pipe(
    Effect.catchAll(() => Effect.void),
    Effect.asVoid,
  );

const runCypher = (sql: SqlClient, query: string, columnDefs = '(result agtype)') =>
  Effect.gen(function* () {
    yield* setSearchPath(sql);
    const statement = `SELECT * FROM ag_catalog.cypher('${GRAPH_NAME}', $$ ${query} $$) AS ${columnDefs}`;
    return yield* sql.unsafe<Record<string, unknown>>(statement).pipe(Effect.mapError(mapSql('cypher')));
  });

/** Project Used/Generated components into AGE. No-op store: components stay SoT. */
export const projectToAge = (sql: SqlClient): Effect.Effect<number, GraphError> =>
  Effect.gen(function* () {
    const ok = yield* ageAvailable(sql);
    if (!ok) {
      return yield* new GraphError({
        operation: 'projectToAge',
        message: 'age extension is not installed',
      });
    }
    yield* setSearchPath(sql);
    yield* ensureGraph(sql);
    const rows = yield* edges(sql);
    const seen = new Set<string>();
    for (const edge of rows) {
      for (const id of [edge.activityId, edge.targetId]) {
        if (seen.has(id)) continue;
        seen.add(id);
        yield* runCypher(sql, `MERGE (:Entity {id: '${escapeCypher(id)}'})`);
      }
      const rel = edge.relation === 'Used' ? 'USED' : 'GENERATED';
      yield* runCypher(
        sql,
        `MATCH (a:Entity {id: '${escapeCypher(edge.activityId)}'}), (b:Entity {id: '${escapeCypher(edge.targetId)}'}) MERGE (a)-[:${rel}]->(b)`,
      );
    }
    return rows.length;
  });

/** Activities that Used this entity, via AGE. Caller must have projected. */
export const usedByAge = (
  sql: SqlClient,
  entityId: string,
): Effect.Effect<ReadonlyArray<string>, GraphError> =>
  Effect.gen(function* () {
    const ok = yield* ageAvailable(sql);
    if (!ok) {
      return yield* new GraphError({
        operation: 'usedByAge',
        message: 'age extension is not installed',
      });
    }
    const rows = yield* runCypher(
      sql,
      `MATCH (a)-[:USED]->(b) WHERE b.id = '${escapeCypher(entityId)}' RETURN a.id`,
      '(id agtype)',
    );
    return rows.flatMap((row) => {
      const raw = row['id'];
      if (typeof raw === 'string') {
        try {
          const parsed: unknown = JSON.parse(raw);
          return typeof parsed === 'string' ? [parsed] : [raw.replace(/^"|"$/g, '')];
        } catch {
          return [raw.replace(/^"|"$/g, '')];
        }
      }
      return raw === null || raw === undefined ? [] : [String(raw)];
    });
  });
