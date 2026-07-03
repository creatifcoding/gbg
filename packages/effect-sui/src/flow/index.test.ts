import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import { describe, expect, it } from 'vitest';

import { SuiPTB, SuiTx } from '../effectable';
import {
  AutoGasPolicy,
  AutoPaymentPolicy,
  decodeSuiObjectDigest,
  decodeSuiObjectId,
  decodeSuiTransactionDigest,
  ExplicitGasPolicy,
  ExplicitPaymentPolicy,
  SuiGasCoinConflictError,
  SuiGasPlanningError,
  SuiInvariantViolation,
  SuiMoveAbortError,
  SuiObjectRef,
  SuiWaitError,
} from '../schema';
import { object } from '../ptb';
import { SuiFinalityService, SuiTxRunner } from '../services';
import {
  makeClient,
  makeFinalityService,
  makeGasPlanner,
  makePaymentService,
  makePreflightService,
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

  it('normalizes gas planning failures into SuiGasPlanningError', () => {
    const planner = makeGasPlanner();
    const tx = new SuiTx({
      label: 'gas.invalid-budget',
      gasPolicy: new ExplicitGasPolicy({ budget: 'not-a-bigint' }),
      execute: () => Effect.void,
    });

    const error = Effect.runSync(Effect.flip(planner.plan(tx)));

    expect(error).toBeInstanceOf(SuiGasPlanningError);
    expect(error.message).toContain('Cannot convert not-a-bigint to a BigInt');
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

    expect(error).toBeInstanceOf(SuiGasCoinConflictError);
    expect(error.message).toContain('Gas payment overlaps PTB object input');
  });

  it('normalizes SDK dry-run MoveAbort and finality wait failures into typed flow errors', async () => {
    const txDigest = decodeSuiTransactionDigest('11111111111111111111111111111112');
    const tx = new SuiTx({ label: 'flow.error-topology', execute: () => Effect.void });
    const preflight = makePreflightService({
      core: {
        simulateTransaction: async () => {
          throw {
            message: 'Move abort in counter::increment',
            executionError: {
              $kind: 'MoveAbort',
              message: 'Move abort in counter::increment',
              command: 0,
              MoveAbort: {
                abortCode: '42',
                location: { package: '0x2', module: 'counter', functionName: 'increment' },
              },
            },
          };
        },
      },
    });
    const finality = makeFinalityService({
      core: {
        waitForTransaction: async () => {
          throw { name: 'AbortError', message: 'aborted by caller' };
        },
      },
    });

    const moveAbort = await Effect.runPromise(Effect.flip(preflight.dryRun({
      tx,
      artifact: { inputs: [], commands: [], requirements: {} },
      auth: { signatures: ['sig'], transactionBytes: new Uint8Array([1]) },
      gasPlan: { requiresDryRun: true, rationale: 'test' },
      payment: { gasPayment: [], sponsored: false, addressBalance: true },
    })));
    const waitError = await Effect.runPromise(Effect.flip(finality.waitForDigest({ digest: txDigest })));

    expect(moveAbort).toBeInstanceOf(SuiMoveAbortError);
    expect(moveAbort.message).toContain('Move abort');
    expect(waitError).toBeInstanceOf(SuiWaitError);
    expect(waitError.kind).toBe('aborted');
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

  it('watches finality through a ManagedRuntime-backed Flow client', async () => {
    const txDigest = decodeSuiTransactionDigest('11111111111111111111111111111112');
    const runtime = ManagedRuntime.make(
      Layer.succeed(SuiFinalityService)({
        wait: (request) => Effect.succeed({ digest: request.execution.digest, transaction: request.execution.raw }),
        waitForDigest: (request) => Effect.succeed({ digest: request.digest, transaction: { _tag: 'WatchedFinality' }, events: [] }),
      }),
    ) as SuiFlowRuntime;
    const client = makeClient(runtime);

    const watcher = client.watchFinality({ digest: txDigest });
    const result = await watcher.join();
    await client.dispose();

    expect(result).toEqual({ digest: txDigest, transaction: { _tag: 'WatchedFinality' }, events: [] });
  });

  it('interrupts finality watchers when the Flow runtime is disposed', async () => {
    const txDigest = decodeSuiTransactionDigest('11111111111111111111111111111112');
    let interrupted = false;
    const runtime = ManagedRuntime.make(
      Layer.succeed(SuiFinalityService)({
        wait: (request) => Effect.succeed({ digest: request.execution.digest, transaction: request.execution.raw }),
        waitForDigest: () => Effect.callback((resume) => {
          const timeout = setTimeout(() => resume(Effect.succeed({ digest: txDigest, transaction: { late: true } })), 60_000);
          return Effect.sync(() => {
            interrupted = true;
            clearTimeout(timeout);
          });
        }),
      }),
    ) as SuiFlowRuntime;
    const client = makeClient(runtime);

    const watcher = client.watchFinality({ digest: txDigest });
    await client.dispose();
    const exit = await watcher.exit();

    expect(Exit.isFailure(exit)).toBe(true);
    expect(interrupted).toBe(true);
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
