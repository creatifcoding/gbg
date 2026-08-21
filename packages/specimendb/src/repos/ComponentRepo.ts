/**
 * ComponentRepo — SqlClient persistence for {@link ComponentModel}.
 *
 * @module @tmnl/specimendb/repos/ComponentRepo
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import type { SqlError } from 'effect/unstable/sql/SqlError';
import { ComponentModel } from '../models/ComponentModel.js';
import type { Component, ComponentKind } from '../schemas/components.js';
import { CatalogError } from '../schemas/errors.js';
import { trustComponentId, type ComponentId, type EntityRef } from '../schemas/identifiers.js';
import { decodeRow, decodeRows } from './_decode.js';

export interface ComponentRepoShape {
  readonly insert: (
    row: typeof ComponentModel.insert.Type,
  ) => Effect.Effect<ComponentModel, CatalogError>;
  readonly findByEntity: (
    entityId: EntityRef,
  ) => Effect.Effect<ReadonlyArray<ComponentModel>, CatalogError>;
  readonly findIdByEntityKind: (
    entityId: EntityRef,
    kind: ComponentKind,
  ) => Effect.Effect<Option.Option<ComponentId>, CatalogError>;
  readonly updatePayload: (
    id: ComponentId,
    payload: Component,
    attachedAt: string,
  ) => Effect.Effect<void, CatalogError>;
}

const catalogError = (operation: string) => (cause: SqlError) =>
  new CatalogError({
    operation,
    message: cause.message,
    cause,
  });

const selectColumns = (sql: SqlClient) => sql`
  id,
  entity_id AS "entityId",
  kind,
  payload,
  attached_at AS "attachedAt"
`;

export class ComponentRepo extends Context.Service<ComponentRepo, ComponentRepoShape>()(
  '@tmnl/specimendb/ComponentRepo',
) {
  static readonly layer = Layer.effect(
    ComponentRepo,
    Effect.gen(function* () {
      const sql = yield* SqlClient;

      const insert = (row: typeof ComponentModel.insert.Type) =>
        Effect.gen(function* () {
          const rows = yield* sql<Record<string, unknown>>`
            INSERT INTO components (id, entity_id, kind, payload, attached_at)
            VALUES (
              ${row.id},
              ${row.entityId},
              ${row.kind},
              ${JSON.stringify(row.payload)}::jsonb,
              ${row.attachedAt}
            )
            RETURNING ${selectColumns(sql)}
          `.pipe(Effect.mapError(catalogError('insertComponent')));
          return yield* decodeRow(ComponentModel, 'insertComponent')(rows[0]);
        });

      const findByEntity = (entityId: EntityRef) =>
        Effect.gen(function* () {
          const rows = yield* sql<Record<string, unknown>>`
            SELECT ${selectColumns(sql)}
            FROM components
            WHERE entity_id = ${entityId}
            ORDER BY attached_at ASC
          `.pipe(Effect.mapError(catalogError('loadComponents')));
          return yield* decodeRows(ComponentModel, 'loadComponents')(rows);
        });

      const findIdByEntityKind = (entityId: EntityRef, kind: ComponentKind) =>
        Effect.gen(function* () {
          const rows = yield* sql<{ id: string }>`
            SELECT id FROM components
            WHERE entity_id = ${entityId} AND kind = ${kind}
            LIMIT 1
          `.pipe(Effect.mapError(catalogError('findComponent')));
          const row = rows[0];
          return row === undefined ? Option.none() : Option.some(trustComponentId(row.id));
        });

      const updatePayload = (id: ComponentId, payload: Component, attachedAt: string) =>
        sql`
          UPDATE components
          SET payload = ${JSON.stringify(payload)}::jsonb, attached_at = ${attachedAt}
          WHERE id = ${id}
        `.pipe(Effect.asVoid, Effect.mapError(catalogError('updateComponent')));

      return ComponentRepo.of({ insert, findByEntity, findIdByEntityKind, updatePayload });
    }),
  );
}
