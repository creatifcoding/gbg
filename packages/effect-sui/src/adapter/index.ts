/** Mysten Sui client adapter surfaces, including the effectSui() $extend registration. */

import type * as Exit from 'effect-v4/Exit';
import * as Layer from 'effect-v4/Layer';

import type { SuiTx } from '../effectable';
import * as SuiFlow from '../flow';
import * as SuiQuery from '../query';
import type { SuiObjectId } from '../schema';
import type { SuiObjectResolveRequest, SuiObjectResolveResult, SuiTxLifecycleResult } from '../services';

export type EffectSuiClientSource = SuiFlow.ClientWithTransactionLifecycle & SuiQuery.ClientWithCoreReads;

export interface EffectSuiAdapterClient {
  readonly flow: SuiFlow.SuiFlowClient;
  readonly query: SuiQuery.SuiQueryClient;
  readonly runTx: (
    tx: SuiTx<unknown, unknown, unknown>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<SuiTxLifecycleResult>;
  readonly runTxExit: (
    tx: SuiTx<unknown, unknown, unknown>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<Exit.Exit<SuiTxLifecycleResult, unknown>>;
  readonly resolveObject: <A>(
    request: SuiObjectResolveRequest<A> | SuiObjectId,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<SuiObjectResolveResult<A>>;
  readonly dispose: () => Promise<void>;
}

export interface EffectSuiRuntimeCache {
  readonly getOrCreate: (
    client: EffectSuiClientSource,
    factory: () => EffectSuiAdapterClient,
  ) => EffectSuiAdapterClient;
  readonly dispose: (client: EffectSuiClientSource) => Promise<void>;
}

export interface EffectSuiAdapterOptions<Name extends string = 'effectSui'> {
  readonly name?: Name;
  readonly cache?: EffectSuiRuntimeCache;
  readonly memoMap?: Layer.MemoMap;
}

export interface EffectSuiExtension<Name extends string = 'effectSui'> {
  readonly name: Name;
  readonly register: (client: EffectSuiClientSource) => EffectSuiAdapterClient;
}

export const makeRuntimeCache = (): EffectSuiRuntimeCache => {
  const entries = new WeakMap<object, EffectSuiAdapterClient>();

  return {
    getOrCreate: (client, factory) => {
      const cached = entries.get(client);
      if (cached) return cached;

      const adapter = factory();
      entries.set(client, adapter);
      return adapter;
    },
    dispose: async (client) => {
      const adapter = entries.get(client);
      if (!adapter) return;
      entries.delete(client);
      await adapter.dispose();
    },
  };
};

export const makeClient = (
  client: EffectSuiClientSource,
  options: Omit<EffectSuiAdapterOptions, 'name'> = {},
): EffectSuiAdapterClient => {
  const cache = options.cache ?? makeRuntimeCache();
  return cache.getOrCreate(client, () => makeUncachedClient(client, options));
};

export function effectSui<const Name extends string = 'effectSui'>(
  options: EffectSuiAdapterOptions<Name> = {},
): EffectSuiExtension<Name> {
  const name = options.name ?? 'effectSui' as Name;
  const cache = options.cache ?? makeRuntimeCache();

  return {
    name,
    register: (client) => makeClient(client, { cache, memoMap: options.memoMap }),
  };
}

const makeUncachedClient = (
  client: EffectSuiClientSource,
  options: Omit<EffectSuiAdapterOptions, 'name'>,
): EffectSuiAdapterClient => {
  const memoMap = options.memoMap ?? Layer.makeMemoMapUnsafe();
  const flow = SuiFlow.makeClient(client, { memoMap });
  const query = SuiQuery.makeClient(client, { memoMap });
  let disposed = false;

  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    await Promise.all([flow.dispose(), query.dispose()]);
  };

  return {
    flow,
    query,
    runTx: (tx, runOptions) => flow.run(tx, runOptions),
    runTxExit: (tx, runOptions) => flow.runExit(tx, runOptions),
    resolveObject: (request, runOptions) => query.resolve(
      typeof request === 'string' ? { id: request } : request,
      runOptions,
    ),
    dispose,
  };
};
