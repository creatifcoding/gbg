import * as ManagedRuntime from 'effect-v4/ManagedRuntime';

import { decode, encodePure, refresh, resolve, serialize } from './operations';
import { makeLayer } from './runtime-layer';
import type { ClientWithCoreReads } from './types';
import type { SuiQueryClient, SuiQueryRuntime, SuiQueryRuntimeOptions } from './runtime-types';

export const makeRuntime = (
  client: ClientWithCoreReads,
  options: SuiQueryRuntimeOptions = {},
): SuiQueryRuntime => ManagedRuntime.make(makeLayer(client), { memoMap: options.memoMap });

export const makeClient = (
  clientOrRuntime: ClientWithCoreReads | SuiQueryRuntime,
  options: SuiQueryRuntimeOptions = {},
): SuiQueryClient => {
  const runtime = ManagedRuntime.isManagedRuntime(clientOrRuntime)
    ? clientOrRuntime as SuiQueryRuntime
    : makeRuntime(clientOrRuntime as ClientWithCoreReads, options);
  return {
    runtime,
    run: (effect, runOptions) => runtime.runPromise(effect, runOptions),
    runExit: (effect, runOptions) => runtime.runPromiseExit(effect, runOptions),
    resolve: (request, runOptions) => runtime.runPromise(resolve(request), runOptions),
    resolveExit: (request, runOptions) => runtime.runPromiseExit(resolve(request), runOptions),
    refresh: (object, runOptions) => runtime.runPromise(refresh(object), runOptions),
    decode: (request, runOptions) => runtime.runPromise(decode(request), runOptions),
    encodePure: (request, runOptions) => runtime.runPromise(encodePure(request), runOptions),
    serialize: (value, codec, runOptions) => runtime.runPromise(serialize(value, codec), runOptions),
    dispose: () => runtime.dispose(),
  };
};
