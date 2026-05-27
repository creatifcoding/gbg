import { requestSuiFromFaucetV2 } from '@mysten/sui/faucet';
import { SuiJsonRpcClient, JsonRpcHTTPTransport } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import { describe, expect, inject, it } from 'vitest';

import { makeLayer as makeFlowLayer } from '../../src/flow';
import {
  counterFixtureDescriptor,
  get,
  getDescriptor,
  makeRegistryLayer,
  module as getModule,
  ptb,
  publishMovePackage,
  publishRequestFromCompiled,
  register,
} from '../../src/package';
import { AutoGasPolicy, AutoPaymentPolicy, decodeSuiAddress, decodeSuiObjectId, KeypairAuthPolicy } from '../../src/schema';
import type { EffectSuiLocalnetContext } from './utils/globalSetup';
import { prepublishMoveFixtures } from './utils/prepublish';

const localnet = inject('effectSuiLocalnet') as EffectSuiLocalnetContext;
const describeLocalnet = localnet.enabled ? describe : describe.skip;

describeLocalnet('@tmnl/effect-sui package registry localnet proof', () => {
  it('publishes the counter fixture through Effect-Sui flow and registers the descriptor', async () => {
    if (!localnet.localnetContainerId) {
      expect(localnet.mode).toBe('external');
      return;
    }

    const client = new SuiJsonRpcClient({
      network: 'localnet',
      transport: new JsonRpcHTTPTransport({ url: localnet.fullnodeUrl }),
    });
    const keypair = Ed25519Keypair.generate();
    const sender = decodeSuiAddress(keypair.getPublicKey().toSuiAddress());
    await requestAndWaitForFaucet(client, sender);

    const compiled = await prepublishMoveFixtures({ suiToolsContainerId: localnet.localnetContainerId });
    const request = publishRequestFromCompiled({
      name: 'counter',
      sender,
      modules: compiled.counter.modules,
      dependencies: compiled.counter.dependencies,
      moduleNames: ['counter'],
    });

    const output = await Effect.runPromise(
      Effect.gen(function* () {
        const published = yield* publishMovePackage({
          request,
          authPolicy: new KeypairAuthPolicy({ signer: keypair, sender }),
          gasPolicy: new AutoGasPolicy({}),
          paymentPolicy: new AutoPaymentPolicy({ addressBalance: true }),
        });
        const descriptor = yield* getDescriptor(published.packageId);
        return { published, descriptor };
      }).pipe(Effect.provide(Layer.mergeAll(makeFlowLayer(client), makeRegistryLayer()))),
    );

    expect(output.published.packageId).toBe(output.descriptor.packageId);
    expect(output.published.digest).toBeDefined();
    expect(output.published.upgradeCapId).toBeDefined();
    expect(output.descriptor.modules).toEqual(['counter']);
  });

  it('registers the counter fixture descriptor after a localnet Move build', async () => {
    if (!localnet.localnetContainerId) {
      expect(localnet.mode).toBe('external');
      return;
    }

    const compiled = await prepublishMoveFixtures({ suiToolsContainerId: localnet.localnetContainerId });
    expect(compiled.counter.modules.length).toBeGreaterThan(0);

    const descriptor = counterFixtureDescriptor(decodeSuiObjectId('0x0'));
    const pkg = await Effect.runPromise(
      Effect.gen(function* () {
        yield* register(descriptor);
        return yield* get(descriptor.packageId);
      }).pipe(Effect.provide(makeRegistryLayer())),
    );
    const counter = await Effect.runPromise(getModule(pkg, 'counter'));
    const increment = ptb(counter, {
      label: 'increment',
      commands: [{ _tag: 'MoveCall', name: 'increment' }],
      build: (self) => Effect.succeed({ inputs: self.inputs, commands: self.commands, requirements: {} }),
    });

    expect(pkg.packageId).toBe(descriptor.packageId);
    expect(counter.label).toContain('counter');
    expect(increment.label).toContain('counter::increment');
  });
});

describe.skipIf(localnet.enabled)('@tmnl/effect-sui package registry localnet proof', () => {
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
