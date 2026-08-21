/**
 * EntityRepo — SqlClient persistence for `entities`.
 *
 * @module @tmnl/specimendb/repos/EntityRepo
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import type { SqlError } from 'effect/unstable/sql/SqlError';
import { CatalogError } from '../schemas/errors.js';
import { EntityRef } from '../schemas/identifiers.js';
import { EntityKind, EntityType } from '../schemas/provenance.js';
import { EntityRepoTag } from '../tags.js';
import { decodeOptional, decodeRow, decodeRows, isoOf } from './_decode.js';

export interface EntityRow {
  readonly id: EntityRef;
  readonly kind: EntityKind;
  readonly type?: EntityType;
  readonly createdAt: string;
}

const EntityRowSchema = Schema.Struct({
  id: EntityRef,
  kind: EntityKind,
  type: Schema.optional(EntityType),
  createdAt: Schema.String,
});

export interface EntityRepoShape {
  readonly insert: (row: EntityRow) => Effect.Effect<EntityRow, CatalogError>;
  readonly findById: (
    id: EntityRef,
  ) => Effect.Effect<Option.Option<EntityRow>, CatalogError>;
  readonly findAll: (
    kind?: EntityKind,
  ) => Effect.Effect<ReadonlyArray<EntityRow>, CatalogError>;
}

const catalogError = (operation: string) => (cause: SqlError) =>
  new CatalogError({ operation, message: cause.message, cause });

const fromSql = (row: {
  id: string;
  kind: string;
  type: string | null;
  createdAt: unknown;
}): unknown => ({
  id: row.id,
  kind: row.kind,
  ...(row.type !== null && row.type.length > 0 ? { type: row.type } : {}),
  createdAt: isoOf(row.createdAt),
});

type SqlEntityRow = {
  id: string;
  kind: string;
  type: string | null;
  createdAt: unknown;
};

export class EntityRepo extends Context.Service<EntityRepo, EntityRepoShape>()(EntityRepoTag) {
  static readonly layer = Layer.effect(
    EntityRepo,
    Effect.gen(function* () {
      const sql = yield* SqlClient;

      const insert: EntityRepoShape['insert'] = (row) =>
        Effect.gen(function* () {
          const rows = yield* sql<SqlEntityRow>`
            INSERT INTO entities (id, kind, type, created_at)
            VALUES (${row.id}, ${row.kind}, ${row.type ?? null}, ${row.createdAt}::timestamptz)
            RETURNING id, kind, type, created_at AS "createdAt"
          `.pipe(Effect.mapError(catalogError('insertEntity')));
          const first = rows[0];
          if (first === undefined) {
            return yield* new CatalogError({
              operation: 'insertEntity',
              message: 'INSERT returned no row',
            });
          }
          return yield* decodeRow(EntityRowSchema, 'insertEntity')(fromSql(first));
        });

      const findById: EntityRepoShape['findById'] = (id) =>
        Effect.gen(function* () {
          const rows = yield* sql<SqlEntityRow>`
            SELECT id, kind, type, created_at AS "createdAt" FROM entities WHERE id = ${id} LIMIT 1
          `.pipe(Effect.mapError(catalogError('findEntity')));
          const mapped = rows.map(fromSql);
          return yield* decodeOptional(EntityRowSchema, 'findEntity')(mapped);
        });

      const findAll: EntityRepoShape['findAll'] = (kind) =>
        Effect.gen(function* () {
          const rows =
            kind === undefined
              ? yield* sql<SqlEntityRow>`
                  SELECT id, kind, type, created_at AS "createdAt" FROM entities ORDER BY created_at ASC
                `.pipe(Effect.mapError(catalogError('listEntities')))
              : yield* sql<SqlEntityRow>`
                  SELECT id, kind, type, created_at AS "createdAt"
                  FROM entities
                  WHERE kind = ${kind}
                  ORDER BY created_at ASC
                `.pipe(Effect.mapError(catalogError('listEntities')));
          return yield* decodeRows(EntityRowSchema, 'listEntities')(rows.map(fromSql));
        });

      return EntityRepo.of({ insert, findById, findAll });
    }),
  );
}
