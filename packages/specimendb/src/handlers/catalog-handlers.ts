/**
 * Catalog systems. Handlers iterate components and write new ones.
 * They talk EntityState, never SqlClient. S in ECS is systems.
 *
 * @module @tmnl/specimendb/handlers/catalog-handlers
 */

import * as Effect from 'effect/Effect';
import { runActivitySystem } from '../adapters/activity.js';
import { trustEntityRef } from '../schemas/identifiers.js';
import { CatalogRpcs } from '../rpc/CatalogRpcs.js';
import { EntityState } from '../state/EntityState.js';

const nowIso = () => new Date().toISOString();

export const CatalogRpcsLive = CatalogRpcs.toLayer(
  Effect.gen(function* () {
    const state = yield* EntityState;
    return CatalogRpcs.of({
      GetEntity: (payload) => state.get(payload.entityId),
      ListEntities: (payload) => state.list(payload.kind, payload.type),
      GetComponents: (payload) =>
        state.get(payload.entityId).pipe(Effect.map((record) => record.components)),
      Attach: (payload) => state.attach(payload.entityId, payload.component),
      MintEntity: (payload) =>
        state.ensure(
          {
            id: payload.id,
            kind: payload.kind,
            ...(payload.type !== undefined ? { type: payload.type } : {}),
            createdAt: payload.createdAt ?? nowIso(),
          },
          payload.components,
        ),
      MintActivity: (payload) =>
        runActivitySystem(state, {
          id: payload.ref ?? trustEntityRef(`gbg:activity:${globalThis.crypto.randomUUID()}`),
          used: payload.used,
          generated: payload.generated,
        }),
    });
  }),
);
