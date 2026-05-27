import type * as Effect from 'effect-v4/Effect';
import type * as Exit from 'effect-v4/Exit';
import type { SuiTx } from '../effectable';
import type {
  SuiAuthServiceShape,
  SuiDiagnosticsShape,
  SuiExecutionServiceShape,
  SuiFinalityServiceShape,
  SuiGasPlannerShape,
  SuiPaymentServiceShape,
  SuiPreflightServiceShape,
  SuiPtbAnalyzerShape,
  SuiPtbCompilerShape,
  SuiReservationServiceShape,
  SuiTxLifecycleResult,
} from '../services';

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
  readonly diagnostics: SuiDiagnosticsShape;
}

export interface SuiTxRunnerOptions {
  readonly reconcile?: (
    partial: Partial<SuiTxLifecycleResult> & { readonly tx: SuiTx<unknown, unknown, unknown> },
    exit: Exit.Exit<SuiTxLifecycleResult, unknown>,
  ) => Effect.Effect<void, unknown, never>;
}
