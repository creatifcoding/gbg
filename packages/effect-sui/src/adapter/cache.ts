/** WeakMap-backed adapter runtime cache. */

import type { EffectSuiAdapterClient, EffectSuiClientSource, EffectSuiRuntimeCache } from './types';

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
    dispose: async (client: EffectSuiClientSource) => {
      const adapter = entries.get(client);
      if (!adapter) return;
      entries.delete(client);
      await adapter.dispose();
    },
  };
};
