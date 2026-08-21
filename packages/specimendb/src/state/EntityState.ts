/**
 * EntityState — live catalog projection. Handlers (systems) talk this, not SQL.
 * Shape mined from tmnl iiot `state/` (in-memory + SQL factory).
 *
 * @module @tmnl/specimendb/state/EntityState
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import type { ComponentRepoShape } from '../repos/ComponentRepo.js';
import type { EntityRepoShape } from '../repos/EntityRepo.js';
import { type Component, StatusComponent, hasComponent, type ComponentKind } from '../schemas/components.js';
import { CatalogError, EntityNotFoundError } from '../schemas/errors.js';
import { type CatalogRecord } from '../schemas/entity.js';
import { type EntityRef } from '../schemas/identifiers.js';
import { type EntityKind, type EntityType } from '../schemas/provenance.js';
import { nextStatus, statusOf } from '../schemas/specimen.js';
import { EntityStateTag } from '../tags.js';

export interface EntityMint {
  readonly id: EntityRef;
  readonly kind: EntityKind;
  readonly type?: EntityType;
  readonly createdAt: string;
}

export interface EntityStateShape {
  readonly mint: (
    entity: EntityMint,
    components: ReadonlyArray<Component>,
  ) => Effect.Effect<CatalogRecord, CatalogError>;
  readonly get: (
    id: EntityRef,
  ) => Effect.Effect<CatalogRecord, CatalogError | EntityNotFoundError>;
  readonly list: (
    kind?: EntityKind,
    type?: EntityType,
  ) => Effect.Effect<ReadonlyArray<CatalogRecord>, CatalogError>;
  readonly attach: (
    id: EntityRef,
    component: Component,
  ) => Effect.Effect<CatalogRecord, CatalogError | EntityNotFoundError>;
  readonly replaceComponent: (
    id: EntityRef,
    kind: ComponentKind,
    component: Component,
  ) => Effect.Effect<CatalogRecord, CatalogError | EntityNotFoundError>;
  readonly promote: (
    id: EntityRef,
  ) => Effect.Effect<CatalogRecord, CatalogError | EntityNotFoundError>;
  readonly ensure: (
    entity: EntityMint,
    components: ReadonlyArray<Component>,
  ) => Effect.Effect<CatalogRecord, CatalogError | EntityNotFoundError>;
}

export class EntityState extends Context.Service<EntityState, EntityStateShape>()(EntityStateTag) {}

const nowIso = () => new Date().toISOString();

const bundle = (
  entity: EntityMint,
  components: ReadonlyArray<Component>,
): CatalogRecord => ({
  id: entity.id,
  kind: entity.kind,
  ...(entity.type !== undefined ? { type: entity.type } : {}),
  createdAt: entity.createdAt,
  components,
});

const makeEnsure =
  (
    ops: Pick<EntityStateShape, 'get' | 'mint' | 'attach'>,
  ): EntityStateShape['ensure'] =>
  (entity, components) =>
    Effect.gen(function* () {
      const existing = yield* ops.get(entity.id).pipe(
        Effect.catchTag('EntityNotFoundError', () => ops.mint(entity, components)),
      );
      let current = existing;
      for (const component of components) {
        if (!hasComponent(current.components, component)) {
          current = yield* ops.attach(entity.id, component);
        }
      }
      return current;
    });

type Store = {
  entities: Map<EntityRef, EntityMint>;
  components: Map<EntityRef, Array<Component>>;
};

export const EntityStateInMemory: Layer.Layer<EntityState> = Layer.effect(
  EntityState,
  Ref.make<Store>({
    entities: new Map(),
    components: new Map(),
  }).pipe(
    Effect.map((store) => {
      const load = (id: EntityRef) =>
        Ref.get(store).pipe(
          Effect.flatMap((s) => {
            const entity = s.entities.get(id);
            if (entity === undefined) {
              return Effect.fail(new EntityNotFoundError({ entityId: id }));
            }
            return Effect.succeed(bundle(entity, s.components.get(id) ?? []));
          }),
        );

      const mint: EntityStateShape['mint'] = (entity, components) =>
        Ref.update(store, (s) => {
          const entities = new Map(s.entities);
          entities.set(entity.id, entity);
          const nextComponents = new Map(s.components);
          nextComponents.set(entity.id, [...components]);
          return { entities, components: nextComponents };
        }).pipe(Effect.as(bundle(entity, components)));

      const list: EntityStateShape['list'] = (kind, type) =>
        Ref.get(store).pipe(
          Effect.map((s) => {
            const rows: Array<CatalogRecord> = [];
            for (const entity of s.entities.values()) {
              if (kind !== undefined && entity.kind !== kind) continue;
              if (type !== undefined && entity.type !== type) continue;
              rows.push(bundle(entity, s.components.get(entity.id) ?? []));
            }
            return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          }),
        );

      const attach: EntityStateShape['attach'] = (id, component) =>
        Effect.gen(function* () {
          yield* load(id);
          yield* Ref.update(store, (s) => {
            const next = new Map(s.components);
            next.set(id, [...(s.components.get(id) ?? []), component]);
            return { ...s, components: next };
          });
          return yield* load(id);
        });

      const replaceComponent: EntityStateShape['replaceComponent'] = (id, kind, component) =>
        Effect.gen(function* () {
          const current = yield* load(id);
          const has = current.components.some((c) => c._tag === kind);
          const next = has
            ? current.components.map((c) => (c._tag === kind ? component : c))
            : [component, ...current.components];
          yield* Ref.update(store, (s) => {
            const components = new Map(s.components);
            components.set(id, [...next]);
            return { ...s, components };
          });
          return yield* load(id);
        });

      const promote: EntityStateShape['promote'] = (id) =>
        Effect.gen(function* () {
          const current = yield* load(id);
          const status = statusOf(current) ?? 'raw';
          if (status === 'dead') return current;
          return yield* replaceComponent(
            id,
            'Status',
            new StatusComponent({ value: nextStatus(status) }),
          );
        });

      const ops = { get: load, mint, attach };
      return EntityState.of({
        mint,
        get: load,
        list,
        attach,
        replaceComponent,
        promote,
        ensure: makeEnsure(ops),
      });
    }),
  ),
);

/**
 * SQL-backed EntityState. Bridges repos → state so handlers never see SqlClient.
 * Shape mined from iiot `makeDeviceStateSql`.
 */
export const makeEntityStateSql = (repos: {
  readonly entities: EntityRepoShape;
  readonly components: ComponentRepoShape;
}): EntityStateShape => {
  const load = (id: EntityRef) =>
    Effect.gen(function* () {
      const entity = yield* repos.entities.findById(id);
      if (Option.isNone(entity)) {
        return yield* new EntityNotFoundError({ entityId: id });
      }
      const components = yield* repos.components.findByEntity(id);
      return bundle(entity.value, components);
    });

  const mint: EntityStateShape['mint'] = (entity, components) =>
    Effect.gen(function* () {
      const written = yield* repos.entities.insert(entity);
      for (const component of components) {
        yield* repos.components.insert(written.id, component, written.createdAt);
      }
      return bundle(written, components);
    });

  const attach: EntityStateShape['attach'] = (id, component) =>
    Effect.gen(function* () {
      yield* load(id);
      yield* repos.components.insert(id, component, nowIso());
      return yield* load(id);
    });

  return {
    mint,
    get: load,
    list: (kind, type) =>
      Effect.gen(function* () {
        const entities = yield* repos.entities.findAll(kind);
        const out: Array<CatalogRecord> = [];
        for (const entity of entities) {
          if (type !== undefined && entity.type !== type) continue;
          const components = yield* repos.components.findByEntity(entity.id);
          out.push(bundle(entity, components));
        }
        return out;
      }),
    attach,
    replaceComponent: (id, kind, component) =>
      Effect.gen(function* () {
        yield* load(id);
        yield* repos.components.replaceKind(id, kind, component, nowIso());
        return yield* load(id);
      }),
    promote: (id) =>
      Effect.gen(function* () {
        const current = yield* load(id);
        const status = statusOf(current) ?? 'raw';
        if (status === 'dead') return current;
        yield* repos.components.replaceKind(
          id,
          'Status',
          new StatusComponent({ value: nextStatus(status) }),
          nowIso(),
        );
        return yield* load(id);
      }),
    ensure: makeEnsure({ get: load, mint, attach }),
  };
};
