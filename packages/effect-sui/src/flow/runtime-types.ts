import type * as Effect from 'effect-v4/Effect';
import * as Exit from 'effect-v4/Exit';
import type * as Fiber from 'effect-v4/Fiber';
import * as Layer from 'effect-v4/Layer';
import * as ManagedRuntime from 'effect-v4/ManagedRuntime';

import type { SuiTx } from '../effectable';
import type {
  SuiAuthService,
  SuiClientService,
  SuiExecutionService,
  SuiFinalityService,
  SuiGasPlanner,
  SuiPaymentService,
  SuiPreflightService,
  SuiPtbAnalyzer,
  SuiPtbCompiler,
  SuiReservationService,
  SuiTxLifecycleResult,
  SuiTxRunner,
} from '../services';
import type { SuiTxRunnerOptions } from './runner';

export type SuiFlowServices = SuiClientService | SuiPtbAnalyzer | SuiPtbCompiler | SuiGasPlanner | SuiPaymentService | SuiAuthService | SuiPreflightService | SuiExecutionService | SuiFinalityService | SuiReservationService | SuiTxRunner;
export type SuiFlowRuntime = ManagedRuntime.ManagedRuntime<SuiFlowServices, never>;

export interface SuiFlowRuntimeOptions extends SuiTxRunnerOptions {
  readonly memoMap?: Layer.MemoMap;
}

export interface SuiFlowClient {
  readonly runtime: SuiFlowRuntime;
  readonly run: (tx: SuiTx<unknown, unknown, unknown>, options?: { readonly signal?: AbortSignal }) => Promise<SuiTxLifecycleResult>;
  readonly runExit: (tx: SuiTx<unknown, unknown, unknown>, options?: { readonly signal?: AbortSignal }) => Promise<Exit.Exit<SuiTxLifecycleResult, unknown>>;
  readonly runFork: (tx: SuiTx<unknown, unknown, unknown>, options?: Effect.RunOptions) => Fiber.Fiber<SuiTxLifecycleResult, unknown>;
  readonly runCallback: (tx: SuiTx<unknown, unknown, unknown>, options: Effect.RunOptions & { readonly onExit: (exit: Exit.Exit<SuiTxLifecycleResult, unknown>) => void }) => (interruptor?: number | undefined) => void;
  readonly dispose: () => Promise<void>;
}
