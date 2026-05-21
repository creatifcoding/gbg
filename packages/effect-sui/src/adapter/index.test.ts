import * as Exit from 'effect-v4/Exit';
import { describe, expect, it } from 'vitest';

import { decodeSuiObjectDigest, decodeSuiObjectId } from '../schema';
import type { EffectSuiClientSource } from './index';
import { effectSui, makeClient, makeRuntimeCache } from './index';

const objectId = decodeSuiObjectId('0x7');
const digest = decodeSuiObjectDigest('11111111111111111111111111111112');

const makeReadClient = (): EffectSuiClientSource => ({
  core: {
    getObject: async ({ objectId: requestedId }) => ({
      object: {
        objectId: requestedId,
        version: '9',
        digest,
        type: '0x2::coin::Coin<0x2::sui::SUI>',
        json: { balance: '777' },
      },
    }),
  },
} as EffectSuiClientSource);

describe('effectSui adapter runtime cache', () => {
  it('registers a Mysten $extend-compatible extension with Flow and Query clients', async () => {
    const source = makeReadClient();
    const extension = effectSui();

    const adapter = extension.register(source);
    const resolved = await adapter.resolveObject({ id: objectId, decodeContent: true });
    await adapter.dispose();

    expect(extension.name).toBe('effectSui');
    expect(resolved.ref?.version).toBe('9');
    expect(resolved.snapshot?.content).toEqual({ balance: '777' });
  });

  it('caches one adapter client per source client and disposes it through the cache', async () => {
    const source = makeReadClient();
    const cache = makeRuntimeCache();

    const first = makeClient(source, { cache });
    const second = makeClient(source, { cache });
    expect(second).toBe(first);

    await cache.dispose(source);
    const afterDispose = await first.query.resolveExit({ id: objectId, decodeContent: true });
    expect(Exit.isFailure(afterDispose)).toBe(true);
  });

  it('supports custom extension names', () => {
    const extension = effectSui({ name: 'tmnl' });
    expect(extension.name).toBe('tmnl');
  });
});
