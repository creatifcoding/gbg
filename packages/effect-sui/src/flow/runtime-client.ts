/** ManagedRuntime-backed SuiFlow client facade. */

import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as ManagedRuntime from 'effect/ManagedRuntime';

import { SuiFinalityService } from '../services';
import { runTx } from './runner';
import { makeLayer } from './runtime-layer';
import type { ClientWithTransactionLifecycle } from './types';
import type { SuiFinalityWatcher, SuiFlowClient, SuiFlowRuntime, SuiFlowRuntimeOptions } from './runtime-types';

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
    watchFinality: (request, runOptions) => makeFinalityWatcher(runtime, request, runOptions),
    dispose: () => runtime.dispose(),
  };
};

const makeFinalityWatcher = (
  runtime: SuiFlowRuntime,
  request: Parameters<SuiFlowClient['watchFinality']>[0],
  runOptions?: Parameters<SuiFlowClient['watchFinality']>[1],
): SuiFinalityWatcher => {
  const fiber = runtime.runFork(SuiFinalityService.use((service) => service.waitForDigest(request)), runOptions);
  return {
    fiber,
    join: () => Effect.runPromise(Fiber.join(fiber)),
    exit: () => Effect.runPromise(Fiber.await(fiber)),
    interrupt: () => Effect.runPromise(Fiber.interrupt(fiber)),
    dispose: () => Effect.runPromise(Fiber.interrupt(fiber)),
  };
};
