/** ManagedRuntime-backed SuiQuery public edge. */

import * as Effect from 'effect-v4/Effect';
import * as Exit from 'effect-v4/Exit';
import * as Layer from 'effect-v4/Layer';
import * as ManagedRuntime from 'effect-v4/ManagedRuntime';

import type { SuiObject, SuiObjectSnapshot } from '../effectable';
import {
  SuiBcsBridge,
  type SuiBcsDecodeRequest,
  SuiClientService,
  SuiObjectResolver,
  type SuiObjectResolveRequest,
  type SuiObjectResolveResult,
  type SuiPureEncodeRequest,
} from '../services';
import { SuiBcsBridgeLive } from './bcs';
import { decode, encodePure, refresh, resolve, serialize } from './operations';
import { SuiObjectResolverFromClient } from './resolver';
import type { ClientWithCoreReads } from './types';

export const SuiQueryLive = Layer.merge(SuiBcsBridgeLive, SuiObjectResolverFromClient);

export type SuiQueryServices = SuiClientService | SuiBcsBridge | SuiObjectResolver;
export type SuiQueryRuntime = ManagedRuntime.ManagedRuntime<SuiQueryServices, never>;

export interface SuiQueryRuntimeOptions {
  readonly memoMap?: Layer.MemoMap;
}

export interface SuiQueryClient {
  readonly runtime: SuiQueryRuntime;
  readonly run: <A, E>(
    effect: Effect.Effect<A, E, SuiQueryServices>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<A>;
  readonly runExit: <A, E>(
    effect: Effect.Effect<A, E, SuiQueryServices>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<Exit.Exit<A, E>>;
  readonly resolve: <A>(
    request: SuiObjectResolveRequest<A>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<SuiObjectResolveResult<A>>;
  readonly resolveExit: <A>(
    request: SuiObjectResolveRequest<A>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<Exit.Exit<SuiObjectResolveResult<A>, unknown>>;
  readonly refresh: <A>(
    object: SuiObject<A, unknown, unknown>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<SuiObjectSnapshot<A>>;
  readonly decode: <A>(request: SuiBcsDecodeRequest<A>, options?: { readonly signal?: AbortSignal }) => Promise<A>;
  readonly encodePure: <A>(request: SuiPureEncodeRequest<A>, options?: { readonly signal?: AbortSignal }) => Promise<Uint8Array>;
  readonly serialize: <A>(value: A, codec: unknown, options?: { readonly signal?: AbortSignal }) => Promise<Uint8Array>;
  readonly dispose: () => Promise<void>;
}

export const makeLayer = (client: ClientWithCoreReads): Layer.Layer<SuiQueryServices, never, never> => SuiQueryLive.pipe(
  Layer.provideMerge(SuiClientService.layer(client)),
);

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
