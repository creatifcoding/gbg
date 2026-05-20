import { requestSuiFromFaucetV2 } from '@mysten/sui/faucet';
import { SuiJsonRpcClient, JsonRpcHTTPTransport } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import * as Effect from 'effect-v4/Effect';
import { describe, expect, inject, it } from 'vitest';

import { SuiTx } from '../../src/effectable';
import {
  AutoGasPolicy,
  AutoPaymentPolicy,
  decodeSuiAddress,
  decodeSuiTypeTagString,
  KeypairAuthPolicy,
} from '../../src/schema';
import {
  makeAuthService,
  makeGasPlanner,
  makePaymentService,
} from '../../src/flow';
import {
  gas,
  input,
  makeBuilder,
  make,
  nestedResult,
  pure,
  SuiPtbAst,
  SuiPtbSplitCoins,
  SuiPtbTransferObjects,
} from '../../src/ptb';
import type { EffectSuiLocalnetContext } from './utils/globalSetup';

const localnet = inject('effectSuiLocalnet') as EffectSuiLocalnetContext;
const describeLocalnet = localnet.enabled ? describe : describe.skip;

describeLocalnet('@tmnl/effect-sui payment/gas/auth localnet proof', () => {
  it('plans gas/payment and signs a real localnet transaction build', async () => {
    const client = new SuiJsonRpcClient({
      network: 'localnet',
      transport: new JsonRpcHTTPTransport({ url: localnet.fullnodeUrl }),
    });
    const keypair = Ed25519Keypair.generate();
    const sender = decodeSuiAddress(keypair.getPublicKey().toSuiAddress());

    await requestAndWaitForFaucet(client, sender);

    const ast = new SuiPtbAst({
      label: 'localnet.payment-auth',
      inputs: [
        pure({ name: 'recipient', typeTag: decodeSuiTypeTagString('address'), value: sender }),
        pure({ name: 'amount', typeTag: decodeSuiTypeTagString('u64'), value: 1_000n }),
      ],
      commands: [
        new SuiPtbSplitCoins({ coin: gas(), amounts: [input(1, 'pure')] }),
        new SuiPtbTransferObjects({ objects: [nestedResult(0, 0)], address: input(0, 'pure') }),
      ],
    });
    const ptb = make(ast);
    const tx = new SuiTx({
      label: 'localnet.payment-auth.tx',
      ptb,
      sender,
      buildMode: 'dry-run',
      gasPolicy: new AutoGasPolicy({}),
      paymentPolicy: new AutoPaymentPolicy({ addressBalance: true }),
      authPolicy: new KeypairAuthPolicy({ signer: keypair, sender }),
      execute: () => Effect.void,
    });

    const builder = makeBuilder();
    const artifact = builder.buildSync(ptb);
    await builder.dispose();
    const gasPlan = await Effect.runPromise(makeGasPlanner(client).plan(tx));
    const paymentPlan = Effect.runSync(makePaymentService().plan(tx, gasPlan));
    const authResult = await Effect.runPromise(
      makeAuthService(client).authorize(tx, paymentPlan, artifact, gasPlan),
    );

    expect(gasPlan.price).toBeDefined();
    expect(gasPlan.requiresDryRun).toBe(true);
    expect(paymentPlan).toEqual({ gasPayment: [], sponsored: false, addressBalance: true });
    expect(authResult.signatures).toHaveLength(1);
    expect(authResult.transactionBytes?.byteLength).toBeGreaterThan(0);

    const simulation = await client.core.simulateTransaction({
      transaction: authResult.transactionBytes!,
      include: { effects: true, transaction: true },
    });

    expect(simulation.$kind).toBe('Transaction');
    if (simulation.$kind === 'Transaction') {
      expect(simulation.Transaction.effects).toBeDefined();
      if (simulation.Transaction.effects && 'success' in simulation.Transaction.effects.status) {
        expect(simulation.Transaction.effects.status.success).toBe(true);
      }
      expect(simulation.Transaction.transaction?.sender).toBe(sender);
    }
  });
});

describe.skipIf(localnet.enabled)('@tmnl/effect-sui payment/gas/auth localnet proof', () => {
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
