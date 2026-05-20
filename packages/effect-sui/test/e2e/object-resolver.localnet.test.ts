import { requestSuiFromFaucetV2 } from '@mysten/sui/faucet';
import { SuiJsonRpcClient, JsonRpcHTTPTransport } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import * as Effect from 'effect-v4/Effect';
import { describe, expect, inject, it } from 'vitest';

import { makeObjectResolver } from '../../src/query';
import { decodeSuiObjectId } from '../../src/schema';
import type { EffectSuiLocalnetContext } from './utils/globalSetup';

const localnet = inject('effectSuiLocalnet') as EffectSuiLocalnetContext;
const describeLocalnet = localnet.enabled ? describe : describe.skip;

describeLocalnet('@tmnl/effect-sui object resolver localnet proof', () => {
  it('resolves a real localnet gas coin ref and JSON snapshot', async () => {
    const client = new SuiJsonRpcClient({
      network: 'localnet',
      transport: new JsonRpcHTTPTransport({ url: localnet.fullnodeUrl }),
    });
    const keypair = Ed25519Keypair.generate();
    const owner = keypair.getPublicKey().toSuiAddress();

    await requestAndWaitForFaucet(client, owner);

    const coins = await eventually(() => client.core.listCoins({ owner }));
    const coin = coins.objects[0];
    expect(coin).toBeDefined();

    const resolver = makeObjectResolver(client as never);
    const resolved = await Effect.runPromise(
      resolver.resolve({ id: decodeSuiObjectId(coin.objectId), decodeContent: true }),
    );

    expect(resolved.id).toBe(decodeSuiObjectId(coin.objectId));
    expect(resolved.ref?.objectId).toBe(decodeSuiObjectId(coin.objectId));
    expect(resolved.ref?.version).toBe(coin.version);
    expect(resolved.ref?.digest).toBe(coin.digest);
    expect(resolved.snapshot?.type).toContain('::coin::Coin');
    expect(resolved.snapshot?.content).toEqual(
      expect.objectContaining({
        balance: expect.any(String),
      }),
    );
  });
});

describe.skipIf(localnet.enabled)('@tmnl/effect-sui object resolver localnet proof', () => {
  it('is skipped by EFFECT_SUI_E2E_MODE=skip', () => {
    expect(localnet.mode).toBe('skip');
  });
});

async function requestAndWaitForFaucet(client: SuiJsonRpcClient, recipient: string): Promise<void> {
  const faucetResponse = await eventually(() =>
    requestSuiFromFaucetV2({ host: localnet.faucetUrl, recipient }),
  );

  const digest = faucetResponse.coins_sent?.[0]?.transferTxDigest;
  if (digest) {
    await eventually(() => client.core.waitForTransaction({ digest }));
  }

  await eventually(async () => {
    const { balance } = await client.core.getBalance({ owner: recipient });
    if (BigInt(balance.balance) <= 0n) {
      throw new Error(`Faucet balance not yet visible for ${recipient}`);
    }
  });
}

async function eventually<T>(effect: () => Promise<T>, timeoutMs = 120_000): Promise<T> {
  const started = Date.now();
  let lastError: unknown;

  while (Date.now() - started < timeoutMs) {
    try {
      return await effect();
    } catch (error) {
      lastError = error;
      await delay(1_000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function delay(ms: number) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
