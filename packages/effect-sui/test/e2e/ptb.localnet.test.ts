import { requestSuiFromFaucetV2 } from '@mysten/sui/faucet';
import { SuiJsonRpcClient, JsonRpcHTTPTransport } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { describe, expect, inject, it } from 'vitest';

import { decodeSuiAddress, decodeSuiTypeTagString } from '../../src/schema';
import {
  gas,
  input,
  makeSuiPtbBuilder,
  makeSuiPTB,
  nestedResult,
  pure,
  SuiPtbAst,
  SuiPtbSplitCoins,
  SuiPtbTransferObjects,
} from '../../src/ptb';
import type { EffectSuiLocalnetContext } from './utils/globalSetup';

const localnet = inject('effectSuiLocalnet') as EffectSuiLocalnetContext;
const describeLocalnet = localnet.enabled ? describe : describe.skip;

describeLocalnet('@tmnl/effect-sui SuiPTB localnet proof', () => {
  it('builds a Schema PTB into a real Mysten Transaction and dry-runs it on localnet', async () => {
    const client = new SuiJsonRpcClient({
      network: 'localnet',
      transport: new JsonRpcHTTPTransport({ url: localnet.fullnodeUrl }),
    });
    const keypair = Ed25519Keypair.generate();
    const sender = decodeSuiAddress(keypair.getPublicKey().toSuiAddress());

    await requestAndWaitForFaucet(client, sender);

    const ast = new SuiPtbAst({
      label: 'localnet.split-and-transfer',
      inputs: [
        pure({ name: 'recipient', typeTag: decodeSuiTypeTagString('address'), value: sender }),
        pure({ name: 'amount', typeTag: decodeSuiTypeTagString('u64'), value: 1_000n }),
      ],
      commands: [
        new SuiPtbSplitCoins({ coin: gas(), amounts: [input(1, 'pure')] }),
        new SuiPtbTransferObjects({ objects: [nestedResult(0, 0)], address: input(0, 'pure') }),
      ],
    });

    const builder = makeSuiPtbBuilder();
    const artifact = builder.buildSync(makeSuiPTB(ast));
    await builder.dispose();
    const transaction = artifact.transaction;
    expect(transaction).toBeDefined();

    transaction?.setSender(sender);

    const result = await client.core.simulateTransaction({
      transaction: transaction!,
      include: { effects: true, transaction: true, commandResults: true },
    });

    expect(result.$kind).toBe('Transaction');
    if (result.$kind === 'Transaction') {
      expect(result.Transaction.effects).toBeDefined();
      expect(result.Transaction.effects?.status).toBeDefined();
      if (result.Transaction.effects && 'success' in result.Transaction.effects.status) {
        expect(result.Transaction.effects.status.success).toBe(true);
      }
      expect(result.Transaction.transaction?.commands.map((command) => command.$kind)).toEqual([
        'SplitCoins',
        'TransferObjects',
      ]);
      expect(result.commandResults).toHaveLength(2);
    }
  });
});

describe.skipIf(localnet.enabled)('@tmnl/effect-sui SuiPTB localnet proof', () => {
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
