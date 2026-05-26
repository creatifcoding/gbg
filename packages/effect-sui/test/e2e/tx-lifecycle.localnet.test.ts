import { requestSuiFromFaucetV2 } from '@mysten/sui/faucet';
import { SuiJsonRpcClient, JsonRpcHTTPTransport } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { describe, expect, inject, it } from 'vitest';

import { SuiTx } from '../../src/effectable';
import { makeClient as makeFlowClient, runTx } from '../../src/flow';
import {
  gas,
  input,
  make as makePtb,
  nestedResult,
  pure,
  SuiPtbAst,
  SuiPtbSplitCoins,
  SuiPtbTransferObjects,
} from '../../src/ptb';
import {
  AutoGasPolicy,
  AutoPaymentPolicy,
  decodeSuiAddress,
  decodeSuiTypeTagString,
  KeypairAuthPolicy,
} from '../../src/schema';
import type { EffectSuiLocalnetContext } from './utils/globalSetup';

const localnet = inject('effectSuiLocalnet') as EffectSuiLocalnetContext;
const describeLocalnet = localnet.enabled ? describe : describe.skip;

describeLocalnet('@tmnl/effect-sui SuiTx lifecycle localnet proof', () => {
  it('runs build → gas/payment → auth → preflight → execute → finality through SuiFlow ManagedRuntime client', async () => {
    const client = new SuiJsonRpcClient({
      network: 'localnet',
      transport: new JsonRpcHTTPTransport({ url: localnet.fullnodeUrl }),
    });
    const keypair = Ed25519Keypair.generate();
    const sender = decodeSuiAddress(keypair.getPublicKey().toSuiAddress());

    await requestAndWaitForFaucet(client, sender);

    const ast = new SuiPtbAst({
      label: 'localnet.tx-lifecycle',
      inputs: [
        pure({ name: 'recipient', typeTag: decodeSuiTypeTagString('address'), value: sender }),
        pure({ name: 'amount', typeTag: decodeSuiTypeTagString('u64'), value: 1_000n }),
      ],
      commands: [
        new SuiPtbSplitCoins({ coin: gas(), amounts: [input(1, 'pure')] }),
        new SuiPtbTransferObjects({ objects: [nestedResult(0, 0)], address: input(0, 'pure') }),
      ],
    });
    const ptb = makePtb(ast);
    const flow = makeFlowClient(client);
    try {
      const tx = new SuiTx({
        label: 'localnet.tx-lifecycle.tx',
        ptb,
        sender,
        buildMode: 'execute',
        gasPolicy: new AutoGasPolicy({}),
        paymentPolicy: new AutoPaymentPolicy({ addressBalance: true }),
        authPolicy: new KeypairAuthPolicy({ signer: keypair, sender }),
        execute: (self) => runTx(self),
      });

      const lifecycle = await flow.run(tx);

      expect(lifecycle.artifact.transaction).toBeDefined();
      expect(lifecycle.gasPlan.price).toBeDefined();
      expect(lifecycle.payment).toEqual({ gasPayment: [], sponsored: false, addressBalance: true });
      expect(lifecycle.auth.signatures).toHaveLength(1);
      expect(lifecycle.auth.transactionBytes?.byteLength).toBeGreaterThan(0);
      expect(lifecycle.preflight?.status).toBe('success');
      expect(lifecycle.execution?.digest).toBeDefined();
      expect(lifecycle.finality?.digest).toBe(lifecycle.execution?.digest);
      expect(lifecycle.finality?.effects).toBeDefined();

      const watcher = flow.watchFinality({ digest: lifecycle.execution!.digest, timeoutMs: 60_000 });
      const watched = await watcher.join().finally(() => watcher.dispose());

      expect(watched.digest).toBe(lifecycle.execution?.digest);
      expect(watched.effects).toBeDefined();
    } finally {
      await flow.dispose();
    }
  });
});

describe.skipIf(localnet.enabled)('@tmnl/effect-sui SuiTx lifecycle localnet proof', () => {
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
