import * as Effect from 'effect-v4/Effect';
import * as Exit from 'effect-v4/Exit';
import * as Layer from 'effect-v4/Layer';
import * as ManagedRuntime from 'effect-v4/ManagedRuntime';
import { describe, expect, it } from 'vitest';

import { SuiPTB, SuiTx } from '../effectable';
import {
  AutoGasPolicy,
  AutoPaymentPolicy,
  decodeSuiObjectDigest,
  decodeSuiObjectId,
  ExplicitGasPolicy,
  ExplicitPaymentPolicy,
  SuiInvariantViolation,
  SuiObjectRef,
} from '../schema';
import { object } from '../ptb';
import { SuiTxRunner } from '../services';
import {
  makeClient,
  makeGasPlanner,
  makePaymentService,
  runTx,
  type SuiFlowRuntime,
} from './index';

describe('Sui payment/gas/auth policies', () => {
  const objectId = decodeSuiObjectId('0x7');
  const digest = decodeSuiObjectDigest('11111111111111111111111111111112');
  const gasRef = new SuiObjectRef({ objectId, version: '1', digest });

  it('plans explicit gas budgets with reference gas price from Core client', async () => {
    const planner = makeGasPlanner({
      core: {
        getReferenceGasPrice: async () => ({ referenceGasPrice: '1000' }),
      },
    });
    const tx = new SuiTx({
      label: 'gas.explicit',
      gasPolicy: new ExplicitGasPolicy({ budget: '10000000' }),
      execute: () => Effect.void,
    });

    const plan = await Effect.runPromise(planner.plan(tx));

    expect(plan).toEqual({
      price: 1000n,
      budget: 10_000_000n,
      requiresDryRun: false,
      rationale: 'explicit gas policy; price=1000; budget=10000000',
    });
  });

  it('marks auto gas as dry-run-required when no explicit budget is present', async () => {
    const planner = makeGasPlanner({
      core: {
        getReferenceGasPrice: async () => ({ referenceGasPrice: '1000' }),
      },
    });
    const tx = new SuiTx({
      label: 'gas.auto',
      gasPolicy: new AutoGasPolicy({}),
      execute: () => Effect.void,
    });

    const plan = await Effect.runPromise(planner.plan(tx));

    expect(plan.requiresDryRun).toBe(true);
    expect(plan.price).toBe(1000n);
    expect(plan.budget).toBeUndefined();
  });

  it('plans address-balance payment by default', () => {
    const service = makePaymentService();
    const tx = new SuiTx({
      label: 'payment.auto',
      paymentPolicy: new AutoPaymentPolicy({ addressBalance: true }),
      execute: () => Effect.void,
    });

    const plan = Effect.runSync(service.plan(tx, { requiresDryRun: true, rationale: 'test' }));

    expect(plan).toEqual({
      gasPayment: [],
      sponsored: false,
      addressBalance: true,
    });
  });

  it('rejects explicit gas payment overlap with PTB object inputs', () => {
    const service = makePaymentService();
    const ptb = new SuiPTB({
      label: 'payment.overlap.ptb',
      inputs: [object(objectId, 'coin')],
      build: () => Effect.succeed({ inputs: [], commands: [], requirements: {} }),
    });
    const tx = new SuiTx({
      label: 'payment.overlap',
      ptb,
      paymentPolicy: new ExplicitPaymentPolicy({ gasPayment: [gasRef] }),
      execute: () => Effect.void,
    });

    const error = Effect.runSync(
      Effect.flip(service.plan(tx, { requiresDryRun: false, rationale: 'test' })),
    );

    expect(String(error)).toContain('Gas payment overlaps PTB object input');
  });

  it('runs lifecycle programs through a ManagedRuntime-backed Flow client', async () => {
    const runtime = ManagedRuntime.make(
      Layer.succeed(SuiTxRunner)({
        run: (tx) => Effect.succeed({
          tx,
          artifact: { inputs: [], commands: [], requirements: {} },
          gasPlan: { requiresDryRun: false, rationale: 'fake-runtime' },
          payment: { gasPayment: [], sponsored: false, addressBalance: true },
          auth: { signatures: ['sig'], transactionBytes: new Uint8Array([1]) },
        }),
      }),
    ) as SuiFlowRuntime;
    const client = makeClient(runtime);
    const tx = new SuiTx({ label: 'runtime.ok', execute: (self) => runTx(self) });

    const result = await client.run(tx);
    await client.dispose();

    expect(result.tx.label).toBe('runtime.ok');
    expect(result.auth.signatures).toEqual(['sig']);
  });

  it('exposes runPromiseExit and disposal semantics at the Flow runtime edge', async () => {
    const runtime = ManagedRuntime.make(
      Layer.succeed(SuiTxRunner)({
        run: (tx) => tx.label === 'runtime.fail'
          ? Effect.fail(new SuiInvariantViolation({ invariant: 'test', message: 'planned failure' }))
          : Effect.succeed({
              tx,
              artifact: { inputs: [], commands: [], requirements: {} },
              gasPlan: { requiresDryRun: false, rationale: 'fake-runtime' },
              payment: { gasPayment: [], sponsored: false, addressBalance: true },
              auth: { signatures: [] },
            }),
      }),
    ) as SuiFlowRuntime;
    const client = makeClient(runtime);

    const failed = await client.runExit(new SuiTx({ label: 'runtime.fail', execute: (self) => runTx(self) }));
    expect(Exit.isFailure(failed)).toBe(true);

    await client.dispose();
    const afterDispose = await client.runExit(new SuiTx({ label: 'runtime.ok', execute: (self) => runTx(self) }));
    expect(Exit.isFailure(afterDispose)).toBe(true);
  });
});
