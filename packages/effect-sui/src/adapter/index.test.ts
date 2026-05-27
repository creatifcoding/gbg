import * as Effect from 'effect-v4/Effect';
import * as Exit from 'effect-v4/Exit';
import { describe, expect, it } from 'vitest';

import { SuiTx } from '../effectable';
import { decodeSuiAddress, decodeSuiObjectDigest, decodeSuiObjectId, WalletCallbackAuthPolicy } from '../schema';
import type { SuiTxLifecycleResult } from '../services';
import type { EffectSuiClientSource, EffectSuiWalletRunOptions } from './index';
import { effectSui, makeClient, makeRuntimeCache, runWalletTxWithFlow } from './index';

const objectId = decodeSuiObjectId('0x7');
const digest = decodeSuiObjectDigest('11111111111111111111111111111112');
const sender = decodeSuiAddress('0x8');
const walletOptions: EffectSuiWalletRunOptions = {
  sender,
  chain: 'sui:localnet',
  account: { address: sender },
  signTransaction: () => Promise.resolve({ signature: 'wallet-signature' }),
};
const walletTx = new SuiTx({
  label: 'wallet.tx',
  execute: () => Effect.succeed({} as never),
});

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

  it('creates explicit wallet run handles with cancel/dispose semantics', async () => {
    let capturedSignal: AbortSignal | undefined;
    const lifecycle = { execution: { digest, raw: {} } } as unknown as SuiTxLifecycleResult;
    const handle = runWalletTxWithFlow({
      runExit: (tx, options) => {
        capturedSignal = options?.signal;
        expect(tx.authPolicy).toBeInstanceOf(WalletCallbackAuthPolicy);
        return Promise.resolve(Exit.succeed(lifecycle));
      },
    }, walletTx, walletOptions);

    expect(capturedSignal?.aborted).toBe(false);
    handle.cancel('user-cancelled');
    expect(capturedSignal?.aborted).toBe(true);
    expect(capturedSignal?.reason).toBe('user-cancelled');
    await expect(handle.promise).resolves.toBe(lifecycle);
  });

  it('maps wallet run failures onto the handle promise without a hidden retry', async () => {
    const handle = runWalletTxWithFlow({
      runExit: () => Promise.resolve(Exit.fail('wallet rejected')),
    }, walletTx, walletOptions);

    await expect(handle.promise).rejects.toMatchObject({ reasons: [{ error: 'wallet rejected' }] });
  });
});
