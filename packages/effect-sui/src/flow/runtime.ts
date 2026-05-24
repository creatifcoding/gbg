/** ManagedRuntime-backed SuiFlow public edge. */

import type * as Effect from 'effect-v4/Effect';
import * as Exit from 'effect-v4/Exit';
import type * as Fiber from 'effect-v4/Fiber';
import * as Layer from 'effect-v4/Layer';
import * as ManagedRuntime from 'effect-v4/ManagedRuntime';

import type { SuiTx } from '../effectable';
import { SuiPtbLive } from '../ptb';
import { SuiReservationServiceLive } from '../reservation';
import {
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
  SuiTxRunner,
  type SuiTxLifecycleResult,
} from '../services';
import { SuiAuthServiceFromClient } from './auth';
import { SuiGasPlannerFromClient } from './gas';
import { SuiPaymentServiceLive } from './payment';
import { makeTxRunnerLayer, runTx, type SuiTxRunnerOptions } from './runner';
import { SuiExecutionServiceFromClient, SuiFinalityServiceFromClient, SuiPreflightServiceFromClient } from './rpc';
import type { ClientWithTransactionLifecycle } from './types';

export const SuiPaymentAuthLive = Layer.mergeAll(
  SuiGasPlannerFromClient,
  SuiPaymentServiceLive,
  SuiAuthServiceFromClient,
);

export const SuiTxLifecycleServices = Layer.mergeAll(
  SuiPtbLive,
  SuiPaymentAuthLive,
  SuiPreflightServiceFromClient,
  SuiExecutionServiceFromClient,
  SuiFinalityServiceFromClient,
  SuiReservationServiceLive,
);

export const makeTxLifecycleLayer = (options: SuiTxRunnerOptions = {}) =>
  makeTxRunnerLayer(options).pipe(Layer.provideMerge(SuiTxLifecycleServices));

export const SuiTxLifecycleLive = makeTxLifecycleLayer();

export type SuiFlowServices =
  | SuiClientService
  | SuiPtbAnalyzer
  | SuiPtbCompiler
  | SuiGasPlanner
  | SuiPaymentService
  | SuiAuthService
  | SuiPreflightService
  | SuiExecutionService
  | SuiFinalityService
  | SuiReservationService
  | SuiTxRunner;

export type SuiFlowRuntime = ManagedRuntime.ManagedRuntime<SuiFlowServices, never>;

export interface SuiFlowRuntimeOptions extends SuiTxRunnerOptions {
  readonly memoMap?: Layer.MemoMap;
}

export interface SuiFlowClient {
  readonly runtime: SuiFlowRuntime;
  readonly run: (
    tx: SuiTx<unknown, unknown, unknown>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<SuiTxLifecycleResult>;
  readonly runExit: (
    tx: SuiTx<unknown, unknown, unknown>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<Exit.Exit<SuiTxLifecycleResult, unknown>>;
  readonly runFork: (
    tx: SuiTx<unknown, unknown, unknown>,
    options?: Effect.RunOptions,
  ) => Fiber.Fiber<SuiTxLifecycleResult, unknown>;
  readonly runCallback: (
    tx: SuiTx<unknown, unknown, unknown>,
    options: Effect.RunOptions & { readonly onExit: (exit: Exit.Exit<SuiTxLifecycleResult, unknown>) => void },
  ) => (interruptor?: number | undefined) => void;
  readonly dispose: () => Promise<void>;
}

export const makeLayer = (
  client: ClientWithTransactionLifecycle,
  options: SuiTxRunnerOptions = {},
): Layer.Layer<SuiFlowServices, never, never> => makeTxLifecycleLayer(options).pipe(
  Layer.provideMerge(SuiClientService.layer(client)),
);

export const makeRuntime = (
  client: ClientWithTransactionLifecycle,
  options: SuiFlowRuntimeOptions = {},
): SuiFlowRuntime => ManagedRuntime.make(makeLayer(client, options), { memoMap: options.memoMap });

export const makeClient = (
  clientOrRuntime: ClientWithTransactionLifecycle | SuiFlowRuntime,
  options: SuiFlowRuntimeOptions = {},
): SuiFlowClient => {
  const runtime = ManagedRuntime.isManagedRuntime(clientOrRuntime)
    ? clientOrRuntime as SuiFlowRuntime
    : makeRuntime(clientOrRuntime as ClientWithTransactionLifecycle, options);
  return {
    runtime,
    run: (tx, runOptions) => runtime.runPromise(runTx(tx), runOptions),
    runExit: (tx, runOptions) => runtime.runPromiseExit(runTx(tx), runOptions),
    runFork: (tx, runOptions) => runtime.runFork(runTx(tx), runOptions),
    runCallback: (tx, runOptions) => runtime.runCallback(runTx(tx), runOptions),
    dispose: () => runtime.dispose(),
  };
};
