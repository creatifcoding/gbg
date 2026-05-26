/** ManagedRuntime-backed SuiFlow client facade. */

import * as ManagedRuntime from 'effect-v4/ManagedRuntime';

import { runTx } from './runner';
import { makeLayer } from './runtime-layer';
import type { ClientWithTransactionLifecycle } from './types';
import type { SuiFlowClient, SuiFlowRuntime, SuiFlowRuntimeOptions } from './runtime-types';

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
