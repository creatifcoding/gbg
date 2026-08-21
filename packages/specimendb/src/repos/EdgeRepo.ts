/**
 * EdgeRepo — append-only SqlClient persistence for {@link EdgeModel}.
 *
 * @module @tmnl/specimendb/repos/EdgeRepo
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import type { SqlError } from 'effect/unstable/sql/SqlError';
import { EdgeModel } from '../models/EdgeModel.js';
import { CatalogError } from '../schemas/errors.js';
import type { EntityRef } from '../schemas/identifiers.js';
import { decodeRow, decodeRows } from './_decode.js';

export interface EdgeRepoShape {
  readonly append: (
    row: typeof EdgeModel.insert.Type,
  ) => Effect.Effect<EdgeModel, CatalogError>;
  readonly findBySrc: (
    src: EntityRef,
  ) => Effect.Effect<ReadonlyArray<EdgeModel>, CatalogError>;
}

const catalogError = (operation: string) => (cause: SqlError) =>
  new CatalogError({
    operation,
    message: cause.message,
    cause,
  });

const selectColumns = (sql: SqlClient) => sql`
  id,
  src,
  rel,
  dst,
  payload,
  at
`;

export class EdgeRepo extends Context.Service<EdgeRepo, EdgeRepoShape>()(
  '@tmnl/specimendb/EdgeRepo',
) {
  static readonly layer = Layer.effect(
    EdgeRepo,
    Effect.gen(function* () {
      const sql = yield* SqlClient;

      const append = (row: typeof EdgeModel.insert.Type) =>
        Effect.gen(function* () {
          const rows = yield* sql<Record<string, unknown>>`
            INSERT INTO edges (id, src, rel, dst, payload, at)
            VALUES (
              ${row.id},
              ${row.src},
              ${row.rel},
              ${row.dst},
              ${JSON.stringify(row.payload)}::jsonb,
              ${row.at}
            )
            RETURNING ${selectColumns(sql)}
          `.pipe(Effect.mapError(catalogError('appendEdge')));
          return yield* decodeRow(EdgeModel, 'appendEdge')(rows[0]);
        });

      const findBySrc = (src: EntityRef) =>
        Effect.gen(function* () {
          const rows = yield* sql<Record<string, unknown>>`
            SELECT ${selectColumns(sql)}
            FROM edges
            WHERE src = ${src}
            ORDER BY at ASC
          `.pipe(Effect.mapError(catalogError('listEdges')));
          return yield* decodeRows(EdgeModel, 'listEdges')(rows);
        });

      return EdgeRepo.of({ append, findBySrc });
    }),
  );
}
