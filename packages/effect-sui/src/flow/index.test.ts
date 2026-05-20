import * as Effect from 'effect-v4/Effect';
import { describe, expect, it } from 'vitest';

import { SuiPTB, SuiTx } from '../effectable';
import {
  AutoGasPolicy,
  AutoPaymentPolicy,
  decodeSuiObjectDigest,
  decodeSuiObjectId,
  ExplicitGasPolicy,
  ExplicitPaymentPolicy,
  SuiObjectRef,
} from '../schema';
import { object } from '../ptb';
import {
  makeSuiGasPlanner,
  makeSuiPaymentService,
} from './index';

describe('Sui payment/gas/auth policies', () => {
  const objectId = decodeSuiObjectId('0x7');
  const digest = decodeSuiObjectDigest('11111111111111111111111111111112');
  const gasRef = new SuiObjectRef({ objectId, version: '1', digest });

  it('plans explicit gas budgets with reference gas price from Core client', async () => {
    const planner = makeSuiGasPlanner({
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
    const planner = makeSuiGasPlanner({
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
    const service = makeSuiPaymentService();
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
    const service = makeSuiPaymentService();
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
});
