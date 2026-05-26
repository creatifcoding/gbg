/** ManagedRuntime-backed adapter client construction. */

import * as Layer from 'effect-v4/Layer';

import * as SuiFlow from '../flow';
import * as SuiQuery from '../query';
import { makeRuntimeCache } from './cache';
import type { EffectSuiAdapterClient, EffectSuiAdapterOptions, EffectSuiClientSource } from './types';

export const makeClient = (
  client: EffectSuiClientSource,
  options: Omit<EffectSuiAdapterOptions, 'name'> = {},
): EffectSuiAdapterClient => {
  const cache = options.cache ?? makeRuntimeCache();
  return cache.getOrCreate(client, () => makeUncachedClient(client, options));
};

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
