import * as Effect from 'effect-v4/Effect';
import * as Ref from 'effect-v4/Ref';
import type { SuiTx } from '../effectable';
import { SuiInvariantViolation } from '../schema';
import type { SuiGasPlan, SuiTxLifecycleResult } from '../services';
import { invariant } from './errors';

export const requirePtb = (
  tx: SuiTx<unknown, unknown, unknown>,
): Effect.Effect<NonNullable<SuiTx<unknown, unknown, unknown>['ptb']>, SuiInvariantViolation> => tx.ptb
  ? Effect.succeed(tx.ptb)
  : Effect.fail(invariant('SuiTxRunner.ptb', `SuiTx ${tx.label} has no PTB`));

export const completeLifecycle = (
  partialRef: Ref.Ref<Partial<SuiTxLifecycleResult> & { tx: SuiTx<unknown, unknown, unknown> }>,
): Effect.Effect<SuiTxLifecycleResult, SuiInvariantViolation> => Effect.gen(function* () {
  const partial = yield* Ref.get(partialRef);
  if (!partial.artifact) return yield* Effect.fail(invariant('SuiTxRunner.artifact', 'Lifecycle completed without a PTB artifact'));
  if (!partial.gasPlan) return yield* Effect.fail(invariant('SuiTxRunner.gasPlan', 'Lifecycle completed without a gas plan'));
  if (!partial.payment) return yield* Effect.fail(invariant('SuiTxRunner.payment', 'Lifecycle completed without a payment plan'));
  if (!partial.auth) return yield* Effect.fail(invariant('SuiTxRunner.auth', 'Lifecycle completed without auth result'));
  return partial as SuiTxLifecycleResult;
});

export const shouldPreflight = (tx: SuiTx<unknown, unknown, unknown>, gasPlan: SuiGasPlan): boolean =>
  tx.buildMode === 'dry-run' || tx.buildMode === 'execute' || tx.buildMode === undefined || gasPlan.requiresDryRun;
