/**
 * Node-only: existing SpecimenRpcs handlers over the in-memory repo.
 * Used by vitest. The Vite page uses memory-client.ts so it never loads Postgres.
 *
 * @module
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as RpcTest from 'effect/unstable/rpc/RpcTest';
import { SpecimenRepo } from '../src/repos/SpecimenRepo.js';
import { SpecimenRpcs, SpecimenRpcsLive } from '../src/rpc/SpecimenRpcs.js';
import type { SpecimenRpcClient } from '../src/ui/catalog-stx.js';
import { makeMemoryRepo } from './memory-client.js';

export const MemorySpecimenRepoLive = Layer.effect(
  SpecimenRepo,
  Effect.sync(() => SpecimenRepo.of(makeMemoryRepo())),
);

export const MemoryCatalogLive = SpecimenRpcsLive.pipe(Layer.provide(MemorySpecimenRepoLive));

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
