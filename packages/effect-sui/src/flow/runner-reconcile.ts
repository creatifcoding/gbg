import * as Effect from 'effect-v4/Effect';
import type * as Exit from 'effect-v4/Exit';
import * as Ref from 'effect-v4/Ref';

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
  if (token) yield* dependencies.reservationService.reconcile(token, { partial, exit });
  if (options.reconcile) yield* options.reconcile(partial, exit);
});
