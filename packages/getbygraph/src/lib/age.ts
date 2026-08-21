/**
 * AGE bind. Empty well until a Cypher MERGE is recorded against a live extension.
 * Do not return SQL projection rows as if Cypher ran.
 *
 * @module @gbg/graph/age
 */

import * as Effect from 'effect/Effect';
import type { SqlClient } from 'effect/unstable/sql/SqlClient';
import type { SqlError } from 'effect/unstable/sql/SqlError';
import { GraphError } from './errors.js';

export const GRAPH_NAME = 'lab_catalog';

const mapSql = (operation: string) => (cause: SqlError) =>
  new GraphError({ operation, message: cause.message, cause });

export const ageAvailable = (sql: SqlClient): Effect.Effect<boolean, GraphError> =>
  Effect.gen(function* () {
    const rows = yield* sql<{ extname: string }>`
      SELECT extname FROM pg_extension WHERE extname = 'age'
    `.pipe(Effect.mapError(mapSql('ageAvailable')));
    return rows.length > 0;
  });

/** Empty well. SQL `usedBy` / `generated` is the live projection. */
export const projectToAge = (sql: SqlClient): Effect.Effect<number, GraphError> =>
  Effect.gen(function* () {
    const ok = yield* ageAvailable(sql);
    if (!ok) {
      return yield* new GraphError({
        operation: 'projectToAge',
        message: 'age extension is not installed',
      });
    }
    return yield* new GraphError({
      operation: 'projectToAge',
      message: 'age is loaded; Cypher MERGE bind is not on this branch yet',
    });
  });
