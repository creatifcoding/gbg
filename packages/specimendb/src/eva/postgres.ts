/**
 * Postgres SourceAdapter. SqlClient is already connected. query(sql) returns Arrow.
 *
 * @module @tmnl/specimendb/eva/postgres
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import type { SqlError } from 'effect/unstable/sql/SqlError';
import { EvaSourceTag } from '../tags.js';
import { rowsToArrow } from './arrow.js';
import { SourceError } from './errors.js';
import type { SourceAdapterShape } from './source.js';

const asRecords = (rows: unknown): ReadonlyArray<Record<string, unknown>> => {
  if (!Array.isArray(rows)) return [];
  return rows as ReadonlyArray<Record<string, unknown>>;
};

const isReadOnlySql = (sqlText: string): boolean => {
  const stripped = sqlText
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .trim();
  const keyword = stripped.split(/\s+/, 1)[0]?.toUpperCase();
  if (keyword !== 'SELECT' && keyword !== 'WITH') return false;
  const withoutStrings = stripped.replace(/'[^']*'/g, "''");
  return !/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY|CALL)\b/i.test(
    withoutStrings,
  );
};

const fail = (operation: string, message: string, cause?: unknown) =>
  new SourceError({
    sourceId: EvaSourceTag,
    operation,
    message,
    ...(cause !== undefined ? { cause } : {}),
  });

const mapSql = (operation: string) => (cause: SqlError) => fail(operation, cause.message, cause);

export class PostgresSqlSource extends Context.Service<PostgresSqlSource, SourceAdapterShape>()(
  EvaSourceTag,
) {
  static readonly layer = Layer.effect(
    PostgresSqlSource,
    Effect.gen(function* () {
      const sql = yield* SqlClient;

      const query: SourceAdapterShape['query'] = (sqlText) =>
        Effect.gen(function* () {
          if (!isReadOnlySql(sqlText)) {
            return yield* fail('query', 'only SELECT / WITH queries are allowed');
          }
          const rows = yield* sql.unsafe(sqlText).pipe(Effect.mapError(mapSql('query')));
          return rowsToArrow(asRecords(rows));
        });

      const schema: SourceAdapterShape['schema'] = () =>
        Effect.gen(function* () {
          const rows = yield* sql<Record<string, unknown>>`
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name IN ('entities', 'components')
            ORDER BY table_name, ordinal_position
          `.pipe(Effect.mapError(mapSql('schema')));
          return rowsToArrow(asRecords(rows));
        });

      return {
        kind: 'sql' as const,
        id: EvaSourceTag,
        query,
        schema,
      } satisfies SourceAdapterShape;
    }),
  );
}
