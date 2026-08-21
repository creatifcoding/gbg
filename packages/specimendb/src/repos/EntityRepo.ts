/**
 * EntityRepo — SqlClient persistence for {@link EntityModel}.
 *
 * @module @tmnl/specimendb/repos/EntityRepo
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import type { SqlError } from 'effect/unstable/sql/SqlError';
import { EntityModel } from '../models/EntityModel.js';
import { CatalogError } from '../schemas/errors.js';
import type { EntityRef } from '../schemas/identifiers.js';
import type { EntityKind } from '../schemas/provenance.js';
import { decodeOptional, decodeRow, decodeRows } from './_decode.js';

export interface EntityRepoShape {
  readonly insert: (
    row: typeof EntityModel.insert.Type,
  ) => Effect.Effect<EntityModel, CatalogError>;
  readonly findById: (
    id: EntityRef,
  ) => Effect.Effect<Option.Option<EntityModel>, CatalogError>;
  readonly findByKind: (
    kind: EntityKind,
  ) => Effect.Effect<ReadonlyArray<EntityModel>, CatalogError>;
}

const catalogError = (operation: string) => (cause: SqlError) =>
  new CatalogError({
    operation,
    message: cause.message,
    cause,
  });

const selectColumns = (sql: SqlClient) => sql`
  id,
  kind,
  created_at AS "createdAt"
`;

export class EntityRepo extends Context.Service<EntityRepo, EntityRepoShape>()(
  '@tmnl/specimendb/EntityRepo',
) {
  static readonly layer = Layer.effect(
    EntityRepo,
    Effect.gen(function* () {
      const sql = yield* SqlClient;

      const insert = (row: typeof EntityModel.insert.Type) =>
        Effect.gen(function* () {
          const rows = yield* sql<Record<string, unknown>>`
            INSERT INTO entities (id, kind, created_at)
            VALUES (${row.id}, ${row.kind}, ${row.createdAt})
            RETURNING ${selectColumns(sql)}
          `.pipe(Effect.mapError(catalogError('insertEntity')));
          const decoded = yield* decodeRow(EntityModel, 'insertEntity')(rows[0]);
          return decoded;
        });

      const findById = (id: EntityRef) =>
        Effect.gen(function* () {
          const rows = yield* sql<Record<string, unknown>>`
            SELECT ${selectColumns(sql)}
            FROM entities
            WHERE id = ${id}
            LIMIT 1
          `.pipe(Effect.mapError(catalogError('findEntity')));
          return yield* decodeOptional(EntityModel, 'findEntity')(rows);
        });

      const findByKind = (kind: EntityKind) =>
        Effect.gen(function* () {
          const rows = yield* sql<Record<string, unknown>>`
            SELECT ${selectColumns(sql)}
            FROM entities
            WHERE kind = ${kind}
            ORDER BY created_at ASC
          `.pipe(Effect.mapError(catalogError('listEntities')));
          return yield* decodeRows(EntityModel, 'listEntities')(rows);
        });

      return EntityRepo.of({ insert, findById, findByKind });
    }),
  );
}
