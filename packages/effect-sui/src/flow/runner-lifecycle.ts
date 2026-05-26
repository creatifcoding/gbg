import * as Effect from 'effect-v4/Effect';
import * as Ref from 'effect-v4/Ref';
import type { SuiTx } from '../effectable';
import type { SuiReservationToken, SuiTxLifecycleResult } from '../services';
import { makeLifecycleReservationRequest } from './reservation-request';
import { completeLifecycle, requirePtb, shouldPreflight } from './runner-completion';
import { reconcileLifecycleExit } from './runner-reconcile';
import type { SuiTxRunnerDependencies, SuiTxRunnerOptions } from './runner-types';

export const runTxLifecycle = (
  tx: SuiTx<unknown, unknown, unknown>,
  dependencies: SuiTxRunnerDependencies,
  options: SuiTxRunnerOptions,
): Effect.Effect<SuiTxLifecycleResult, unknown, never> => Effect.gen(function* () {
  const partialRef = yield* Ref.make<Partial<SuiTxLifecycleResult> & { tx: SuiTx<unknown, unknown, unknown> }>({ tx });
  const reservationRef = yield* Ref.make<SuiReservationToken | undefined>(undefined);
  const remember = (patch: Partial<SuiTxLifecycleResult>) => Ref.update(partialRef, (partial) => ({ ...partial, ...patch }));

  const program = Effect.gen(function* () {
    const ptb = yield* requirePtb(tx);
    const analysis = yield* dependencies.ptbAnalyzer.analyze(ptb);
    const artifact = yield* dependencies.ptbCompiler.compile({ ptb, analysis, buildMode: tx.buildMode });
    yield* remember({ artifact });

    const gasPlan = yield* dependencies.gasPlanner.plan(tx);
    yield* remember({ gasPlan });

    const payment = yield* dependencies.paymentService.plan(tx, gasPlan);
    yield* remember({ payment });

    const reservation = yield* dependencies.reservationService.acquire(makeLifecycleReservationRequest(tx, artifact, payment));
    yield* Ref.set(reservationRef, reservation);

    const auth = yield* dependencies.authService.authorize(tx, payment, artifact, gasPlan);
    yield* remember({ auth });

    const preflight = shouldPreflight(tx, gasPlan)
      ? yield* dependencies.preflightService.dryRun({ tx, artifact, auth, gasPlan, payment })
      : undefined;
    if (preflight) yield* remember({ preflight });

    if (tx.buildMode === 'build-only' || tx.buildMode === 'dry-run') return yield* completeLifecycle(partialRef);

    const executionResult = yield* dependencies.executionService.execute({ tx, artifact, auth, gasPlan, payment, preflight });
    yield* remember({ execution: executionResult });

    const finality = yield* dependencies.finalityService.wait({ tx, execution: executionResult });
    yield* remember({ finality });

    return yield* completeLifecycle(partialRef);
  });

  return yield* Effect.onExit(program, reconcileLifecycleExit(dependencies, options, partialRef, reservationRef));
});
