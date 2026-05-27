/** SuiTx lifecycle runner service assembly. */

import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import type { SuiTx } from '../effectable';
import {
  SuiAuthService,
  SuiDiagnostics,
  SuiExecutionService,
  SuiFinalityService,
  SuiGasPlanner,
  SuiPaymentService,
  SuiPreflightService,
  SuiPtbAnalyzer,
  SuiPtbCompiler,
  SuiReservationService,
  SuiTxRunner,
  type SuiTxLifecycleResult,
  type SuiTxRunnerShape,
} from '../services';
import { runTxLifecycle } from './runner-lifecycle';
import type { SuiTxRunnerDependencies, SuiTxRunnerOptions } from './runner-types';

export type { SuiTxRunnerDependencies, SuiTxRunnerOptions } from './runner-types';

export const makeTxRunner = (
  dependencies: SuiTxRunnerDependencies,
  options: SuiTxRunnerOptions = {},
): SuiTxRunnerShape => ({
  run: (tx) => runTxLifecycle(tx, dependencies, options).pipe(
    Effect.withSpan('@tmnl/effect-sui/SuiTxRunner.run', { attributes: { label: tx.label, mode: tx.buildMode ?? 'execute' } }),
  ),
});

export const makeTxRunnerLayer = (options: SuiTxRunnerOptions = {}) => Layer.effect(SuiTxRunner)(
  Effect.gen(function* () {
    const ptbAnalyzer = yield* SuiPtbAnalyzer;
    const ptbCompiler = yield* SuiPtbCompiler;
    const gasPlanner = yield* SuiGasPlanner;
    const paymentService = yield* SuiPaymentService;
    const authService = yield* SuiAuthService;
    const preflightService = yield* SuiPreflightService;
    const executionService = yield* SuiExecutionService;
    const finalityService = yield* SuiFinalityService;
    const reservationService = yield* SuiReservationService;
    const diagnostics = yield* SuiDiagnostics;
    return makeTxRunner({ ptbAnalyzer, ptbCompiler, gasPlanner, paymentService, authService, preflightService, executionService, finalityService, reservationService, diagnostics }, options);
  }),
);

export const SuiTxRunnerLive = makeTxRunnerLayer();

export const runTx = (
  tx: SuiTx<unknown, unknown, unknown>,
): Effect.Effect<SuiTxLifecycleResult, unknown, SuiTxRunner> => SuiTxRunner.use((runner) => runner.run(tx));
