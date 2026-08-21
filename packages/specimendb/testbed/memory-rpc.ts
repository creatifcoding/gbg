/**
 * Node-only: SpecimenRpcs over in-memory SpecimenRepo + EntityState.
 * Used by vitest. The Vite page uses memory-client.ts so it never loads Postgres.
 *
 * @module
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as RpcTest from 'effect/unstable/rpc/RpcTest';
import { SpecimenRepoMemory } from '../src/adapters/specimen-memory.js';
import { CatalogRpcsLive } from '../src/handlers/catalog-handlers.js';
import { CatalogRpcs } from '../src/rpc/CatalogRpcs.js';
import { SpecimenRpcs, SpecimenRpcsLive } from '../src/rpc/SpecimenRpcs.js';
import { EntityStateInMemory } from '../src/state/EntityState.js';
import type { SpecimenRpcClient } from '../src/ui/catalog-stx.js';

export const MemoryCatalogLive = Layer.mergeAll(SpecimenRpcsLive, CatalogRpcsLive).pipe(
  Layer.provide(SpecimenRepoMemory),
  Layer.provideMerge(EntityStateInMemory),
);

export const bootMemoryRpcClient = (): Promise<SpecimenRpcClient> =>
  new Promise((resolve, reject) => {
    const run = Effect.scoped(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        yield* Effect.sync(() => resolve(client));
        yield* Effect.never;
      }),
    ).pipe(
      Effect.provide(MemoryCatalogLive),
      Effect.catchCause((cause) => Effect.sync(() => reject(cause))),
    );
    Effect.runFork(run);
  });

export const MemoryAllRpcs = {
  Specimen: SpecimenRpcs,
  Catalog: CatalogRpcs,
} as const;
