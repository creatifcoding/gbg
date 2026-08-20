/**
 * DuckDB file-database client. Not an Effect SQL driver — a thin
 * repository-facing wrapper around `@duckdb/node-api`.
 *
 * @module @tmnl/specimendb/repos/duckdb
 */

import { DuckDBInstance, type DuckDBValue } from '@duckdb/node-api';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { CatalogConfigTag } from '../schemas/config.js';
import { CatalogError } from '../schemas/errors.js';

export interface DuckDbClientShape {
  readonly run: (sql: string) => Effect.Effect<void, CatalogError>;
  readonly runValues: (
    sql: string,
    values: ReadonlyArray<DuckDBValue>,
  ) => Effect.Effect<void, CatalogError>;
  readonly query: (
    sql: string,
    values?: ReadonlyArray<DuckDBValue>,
  ) => Effect.Effect<ReadonlyArray<Record<string, unknown>>, CatalogError>;
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS specimens (
     id VARCHAR PRIMARY KEY,
     created_at VARCHAR NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS components (
     id VARCHAR PRIMARY KEY,
     specimen_id VARCHAR NOT NULL,
     kind VARCHAR NOT NULL,
     payload JSON NOT NULL,
     attached_at VARCHAR NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_components_specimen ON components(specimen_id)`,
  `CREATE INDEX IF NOT EXISTS idx_components_specimen_kind ON components(specimen_id, kind)`,
];

export class DuckDbClient extends Context.Service<DuckDbClient, DuckDbClientShape>()(
  '@tmnl/specimendb/DuckDbClient',
) {
  static readonly layer = Layer.effect(
    DuckDbClient,
    Effect.gen(function* () {
      const config = yield* CatalogConfigTag;

      const connection = yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: async () => {
            const instance = await DuckDBInstance.create(config.databasePath);
            return instance.connect();
          },
          catch: (cause) =>
            new CatalogError({
              operation: 'open',
              message: `Failed to open DuckDB at ${config.databasePath}`,
              cause,
            }),
        }),
        (conn) =>
          Effect.sync(() => {
            conn.closeSync();
          }),
      );

      const fail = (operation: string, cause: unknown) =>
        new CatalogError({
          operation,
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        });

      const run = (sql: string) =>
        Effect.tryPromise({
          try: () => connection.run(sql),
          catch: (cause) => fail('run', cause),
        }).pipe(Effect.asVoid);

      const runValues = (sql: string, values: ReadonlyArray<DuckDBValue>) =>
        Effect.tryPromise({
          try: async () => {
            const prepared = await connection.prepare(sql);
            prepared.bind([...values]);
            await prepared.run();
          },
          catch: (cause) => fail('runValues', cause),
        });

      const query = (sql: string, values?: ReadonlyArray<DuckDBValue>) =>
        Effect.tryPromise({
          try: async () => {
            const reader = values
              ? await connection.runAndReadAll(sql, [...values])
              : await connection.runAndReadAll(sql);
            return reader.getRowObjectsJson() as Array<Record<string, unknown>>;
          },
          catch: (cause) => fail('query', cause),
        });

      for (const statement of SCHEMA_STATEMENTS) {
        yield* run(statement);
      }

      return DuckDbClient.of({ run, runValues, query });
    }),
  );
}

