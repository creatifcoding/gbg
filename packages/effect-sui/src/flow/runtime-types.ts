import type * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import type * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';

import type { SuiTx } from '../effectable';
import type {
  SuiAuthService,
  SuiClientService,
  SuiDiagnostics,
  SuiExecutionService,
  SuiFinalityResult,
  SuiFinalityService,
  SuiFinalityWatchRequest,
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

export type SuiFlowServices = SuiClientService | SuiPtbAnalyzer | SuiPtbCompiler | SuiGasPlanner | SuiPaymentService | SuiAuthService | SuiPreflightService | SuiExecutionService | SuiFinalityService | SuiReservationService | SuiDiagnostics | SuiTxRunner;
export type SuiFlowRuntime = ManagedRuntime.ManagedRuntime<SuiFlowServices, never>;

export interface SuiFlowRuntimeOptions extends SuiTxRunnerOptions {
  readonly memoMap?: Layer.MemoMap;
}

export interface SuiFinalityWatcher {
  readonly fiber: Fiber.Fiber<SuiFinalityResult, unknown>;
  readonly join: () => Promise<SuiFinalityResult>;
  readonly exit: () => Promise<Exit.Exit<SuiFinalityResult, unknown>>;
  readonly interrupt: () => Promise<void>;
  readonly dispose: () => Promise<void>;
}

export interface SuiFlowClient {
  readonly runtime: SuiFlowRuntime;
  readonly run: (tx: SuiTx<unknown, unknown, unknown>, options?: { readonly signal?: AbortSignal }) => Promise<SuiTxLifecycleResult>;
  readonly runExit: (tx: SuiTx<unknown, unknown, unknown>, options?: { readonly signal?: AbortSignal }) => Promise<Exit.Exit<SuiTxLifecycleResult, unknown>>;
  readonly runFork: (tx: SuiTx<unknown, unknown, unknown>, options?: Effect.RunOptions) => Fiber.Fiber<SuiTxLifecycleResult, unknown>;
  readonly runCallback: (tx: SuiTx<unknown, unknown, unknown>, options: Effect.RunOptions & { readonly onExit: (exit: Exit.Exit<SuiTxLifecycleResult, unknown>) => void }) => (interruptor?: number | undefined) => void;
  readonly watchFinality: (request: SuiFinalityWatchRequest, options?: Effect.RunOptions) => SuiFinalityWatcher;
  readonly dispose: () => Promise<void>;
}
