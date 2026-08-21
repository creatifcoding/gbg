/**
 * ComponentRepo — SqlClient persistence for components keyed by entity_id.
 *
 * @module @tmnl/specimendb/repos/ComponentRepo
 */

import { randomUUID } from 'node:crypto';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import type { SqlError } from 'effect/unstable/sql/SqlError';
import { CatalogError } from '../schemas/errors.js';
import { Component, type ComponentKind } from '../schemas/components.js';
import { type EntityRef } from '../schemas/identifiers.js';
import { ComponentRepoTag } from '../tags.js';
import { parseJson } from './_decode.js';

export interface ComponentRepoShape {
  readonly insert: (
    entityId: EntityRef,
    component: typeof Component.Type,
    attachedAt: string,
  ) => Effect.Effect<void, CatalogError>;
  readonly findByEntity: (
    entityId: EntityRef,
  ) => Effect.Effect<ReadonlyArray<typeof Component.Type>, CatalogError>;
  readonly replaceKind: (
    entityId: EntityRef,
    kind: ComponentKind,
    component: typeof Component.Type,
    attachedAt: string,
  ) => Effect.Effect<void, CatalogError>;
}

const catalogError = (operation: string) => (cause: SqlError) =>
  new CatalogError({ operation, message: cause.message, cause });

const decodeComponent = Schema.decodeUnknownEffect(Component);

const rowsToComponents = (
  rows: ReadonlyArray<Record<string, unknown>>,
): Effect.Effect<ReadonlyArray<typeof Component.Type>, CatalogError> =>
  Effect.gen(function* () {
    const out: Array<typeof Component.Type> = [];
    for (const row of rows) {
      const decoded = yield* decodeComponent(parseJson(row['payload'])).pipe(
        Effect.mapError(
          (cause) =>
            new CatalogError({
              operation: 'decodeComponent',
              message: 'Failed to decode stored component',
              cause,
            }),
        ),
      );
      out.push(decoded);
    }
    return out;
  });

export class ComponentRepo extends Context.Service<ComponentRepo, ComponentRepoShape>()(
  ComponentRepoTag,
) {
  static readonly layer = Layer.effect(
    ComponentRepo,
    Effect.gen(function* () {
      const sql = yield* SqlClient;

      const insert: ComponentRepoShape['insert'] = (entityId, component, attachedAt) =>
        sql`
          INSERT INTO components (id, entity_id, kind, payload, attached_at)
          VALUES (
            ${randomUUID()},
            ${entityId},
            ${component._tag},
            ${JSON.stringify(component)}::jsonb,
            ${attachedAt}::timestamptz
          )
        `.pipe(Effect.asVoid, Effect.mapError(catalogError('insertComponent')));

      const findByEntity: ComponentRepoShape['findByEntity'] = (entityId) =>
        Effect.gen(function* () {
          const rows = yield* sql<Record<string, unknown>>`
            SELECT payload, attached_at
            FROM components
            WHERE entity_id = ${entityId}
            ORDER BY attached_at ASC
          `.pipe(Effect.mapError(catalogError('loadComponents')));
          return yield* rowsToComponents(rows);
        });

      const replaceKind: ComponentRepoShape['replaceKind'] = (
        entityId,
        kind,
        component,
        attachedAt,
      ) =>
        Effect.gen(function* () {
          const existing = yield* sql<{ id: string }>`
            SELECT id FROM components
            WHERE entity_id = ${entityId} AND kind = ${kind}
            LIMIT 1
          `.pipe(Effect.mapError(catalogError('replaceComponent')));
          const row = existing[0];
          if (row === undefined) {
            yield* insert(entityId, component, attachedAt);
            return;
          }
          yield* sql`
            UPDATE components
            SET payload = ${JSON.stringify(component)}::jsonb,
                attached_at = ${attachedAt}::timestamptz
            WHERE id = ${row.id}
          `.pipe(Effect.asVoid, Effect.mapError(catalogError('replaceComponent')));
        });

      return ComponentRepo.of({ insert, findByEntity, replaceKind });
    }),
  );
}
