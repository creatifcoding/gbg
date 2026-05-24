/** SuiTx lifecycle runner for SuiFlow. */

import * as Effect from 'effect-v4/Effect';
import * as Exit from 'effect-v4/Exit';
import * as Layer from 'effect-v4/Layer';
import * as Ref from 'effect-v4/Ref';

import type { SuiTx } from '../effectable';
import { SuiInvariantViolation } from '../schema';
import {
  SuiAuthService,
  type SuiAuthServiceShape,
  SuiExecutionService,
  type SuiExecutionServiceShape,
  SuiFinalityService,
  type SuiFinalityServiceShape,
  SuiGasPlanner,
  type SuiGasPlan,
  type SuiGasPlannerShape,
  SuiPaymentService,
  type SuiPaymentServiceShape,
  SuiPreflightService,
  type SuiPreflightServiceShape,
  SuiPtbAnalyzer,
  type SuiPtbAnalyzerShape,
  SuiPtbCompiler,
  type SuiPtbCompilerShape,
  SuiReservationService,
  type SuiReservationServiceShape,
  type SuiReservationToken,
  SuiTxRunner,
  type SuiTxLifecycleResult,
  type SuiTxRunnerShape,
} from '../services';
import { invariant } from './errors';
import { makeLifecycleReservationRequest } from './reservation-request';

export interface SuiTxRunnerDependencies {
  readonly ptbAnalyzer: SuiPtbAnalyzerShape;
  readonly ptbCompiler: SuiPtbCompilerShape;
  readonly gasPlanner: SuiGasPlannerShape;
  readonly paymentService: SuiPaymentServiceShape;
  readonly authService: SuiAuthServiceShape;
  readonly preflightService: SuiPreflightServiceShape;
  readonly executionService: SuiExecutionServiceShape;
  readonly finalityService: SuiFinalityServiceShape;
  readonly reservationService: SuiReservationServiceShape;
}

export interface SuiTxRunnerOptions {
  readonly reconcile?: (
    partial: Partial<SuiTxLifecycleResult> & { readonly tx: SuiTx<unknown, unknown, unknown> },
    exit: Exit.Exit<SuiTxLifecycleResult, unknown>,
  ) => Effect.Effect<void, unknown, never>;
}

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
    return makeTxRunner({ ptbAnalyzer, ptbCompiler, gasPlanner, paymentService, authService, preflightService, executionService, finalityService, reservationService }, options);
  }),
);

export const SuiTxRunnerLive = makeTxRunnerLayer();

export const runTx = (
  tx: SuiTx<unknown, unknown, unknown>,
): Effect.Effect<SuiTxLifecycleResult, unknown, SuiTxRunner> => SuiTxRunner.use((runner) => runner.run(tx));

function runTxLifecycle(
  tx: SuiTx<unknown, unknown, unknown>,
  dependencies: SuiTxRunnerDependencies,
  options: SuiTxRunnerOptions,
): Effect.Effect<SuiTxLifecycleResult, unknown, never> {
  return Effect.gen(function* () {
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

      if (tx.buildMode === 'build-only' || tx.buildMode === 'dry-run') {
        return yield* completeLifecycle(partialRef);
      }

      const executionResult = yield* dependencies.executionService.execute({ tx, artifact, auth, gasPlan, payment, preflight });
      yield* remember({ execution: executionResult });

      const finality = yield* dependencies.finalityService.wait({ tx, execution: executionResult });
      yield* remember({ finality });

      return yield* completeLifecycle(partialRef);
    });

    return yield* Effect.onExit(program, (exit) => Effect.gen(function* () {
      const token = yield* Ref.get(reservationRef);
      const partial = yield* Ref.get(partialRef);
      if (token) {
        yield* dependencies.reservationService.reconcile(token, { partial, exit });
      }
      if (options.reconcile) {
        yield* options.reconcile(partial, exit);
      }
    }));
  });
}

function requirePtb(
  tx: SuiTx<unknown, unknown, unknown>,
): Effect.Effect<NonNullable<SuiTx<unknown, unknown, unknown>['ptb']>, SuiInvariantViolation> {
  return tx.ptb
    ? Effect.succeed(tx.ptb)
    : Effect.fail(invariant('SuiTxRunner.ptb', `SuiTx ${tx.label} has no PTB`));
}

function completeLifecycle(
  partialRef: Ref.Ref<Partial<SuiTxLifecycleResult> & { tx: SuiTx<unknown, unknown, unknown> }>,
): Effect.Effect<SuiTxLifecycleResult, SuiInvariantViolation> {
  return Effect.gen(function* () {
    const partial = yield* Ref.get(partialRef);
    if (!partial.artifact) return yield* Effect.fail(invariant('SuiTxRunner.artifact', 'Lifecycle completed without a PTB artifact'));
    if (!partial.gasPlan) return yield* Effect.fail(invariant('SuiTxRunner.gasPlan', 'Lifecycle completed without a gas plan'));
    if (!partial.payment) return yield* Effect.fail(invariant('SuiTxRunner.payment', 'Lifecycle completed without a payment plan'));
    if (!partial.auth) return yield* Effect.fail(invariant('SuiTxRunner.auth', 'Lifecycle completed without auth result'));
    return partial as SuiTxLifecycleResult;
  });
}

function shouldPreflight(tx: SuiTx<unknown, unknown, unknown>, gasPlan: SuiGasPlan): boolean {
  return tx.buildMode === 'dry-run' || tx.buildMode === 'execute' || tx.buildMode === undefined || gasPlan.requiresDryRun;
}
