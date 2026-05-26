/** Mysten `$extend`-compatible Effect-Sui extension factory. */

import { makeRuntimeCache } from './cache';
import { makeClient } from './client';
import type { EffectSuiAdapterOptions, EffectSuiExtension } from './types';

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
