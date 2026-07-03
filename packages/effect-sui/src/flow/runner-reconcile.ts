import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Ref from 'effect/Ref';

import { SuiDiagnosticEvent } from '../schema';
import type { SuiTx } from '../effectable';
import type { SuiReservationToken, SuiTxLifecycleResult } from '../services';
import type { SuiTxRunnerDependencies, SuiTxRunnerOptions } from './runner-types';

type LifecyclePartial = Partial<SuiTxLifecycleResult> & { tx: SuiTx<unknown, unknown, unknown> };

export const reconcileLifecycleExit = (
  dependencies: SuiTxRunnerDependencies,
  options: SuiTxRunnerOptions,
  partialRef: Ref.Ref<LifecyclePartial>,
  reservationRef: Ref.Ref<SuiReservationToken | undefined>,
) => (exit: Exit.Exit<SuiTxLifecycleResult, unknown>): Effect.Effect<void, unknown, never> => Effect.gen(function* () {
  const token = yield* Ref.get(reservationRef);
  const partial = yield* Ref.get(partialRef);
  if (Exit.isFailure(exit)) yield* recordLifecycleFailure(dependencies, partial, exit);
  if (token) yield* dependencies.reservationService.reconcile(token, { partial, exit });
  if (options.reconcile) yield* options.reconcile(partial, exit);
});

const recordLifecycleFailure = (
  dependencies: SuiTxRunnerDependencies,
  partial: LifecyclePartial,
  exit: Exit.Failure<SuiTxLifecycleResult, unknown>,
): Effect.Effect<void, never, never> => Effect.gen(function* () {
  const diagnostic = yield* dependencies.diagnostics.classifyCause(exit.cause);
  yield* Effect.annotateCurrentSpan({
    'sui.diagnostic.category': diagnostic.category,
    'sui.diagnostic.severity': diagnostic.severity,
    'sui.diagnostic.retryHint': diagnostic.retryHint,
    'sui.tx.label': partial.tx.label,
  });
  yield* dependencies.diagnostics.record(new SuiDiagnosticEvent({
    name: '@tmnl/effect-sui/SuiTxRunner.failure',
    stage: partial.tx.buildMode ?? 'execute',
    diagnostic,
    attributes: { label: partial.tx.label },
  }));
});
