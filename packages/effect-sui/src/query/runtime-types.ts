import * as Effect from 'effect-v4/Effect';
import * as Exit from 'effect-v4/Exit';
import * as Layer from 'effect-v4/Layer';
import * as ManagedRuntime from 'effect-v4/ManagedRuntime';

import type { SuiObject, SuiObjectSnapshot } from '../effectable';
import type {
  SuiBcsBridge,
  SuiBcsDecodeRequest,
  SuiClientService,
  SuiObjectResolver,
  SuiObjectResolveRequest,
  SuiObjectResolveResult,
  SuiPureEncodeRequest,
} from '../services';

export type SuiQueryServices = SuiClientService | SuiBcsBridge | SuiObjectResolver;
export type SuiQueryRuntime = ManagedRuntime.ManagedRuntime<SuiQueryServices, never>;
export interface SuiQueryRuntimeOptions { readonly memoMap?: Layer.MemoMap }

export interface SuiQueryClient {
  readonly runtime: SuiQueryRuntime;
  readonly run: <A, E>(effect: Effect.Effect<A, E, SuiQueryServices>, options?: { readonly signal?: AbortSignal }) => Promise<A>;
  readonly runExit: <A, E>(effect: Effect.Effect<A, E, SuiQueryServices>, options?: { readonly signal?: AbortSignal }) => Promise<Exit.Exit<A, E>>;
  readonly resolve: <A>(request: SuiObjectResolveRequest<A>, options?: { readonly signal?: AbortSignal }) => Promise<SuiObjectResolveResult<A>>;
  readonly resolveExit: <A>(request: SuiObjectResolveRequest<A>, options?: { readonly signal?: AbortSignal }) => Promise<Exit.Exit<SuiObjectResolveResult<A>, unknown>>;
  readonly refresh: <A>(object: SuiObject<A, unknown, unknown>, options?: { readonly signal?: AbortSignal }) => Promise<SuiObjectSnapshot<A>>;
  readonly decode: <A>(request: SuiBcsDecodeRequest<A>, options?: { readonly signal?: AbortSignal }) => Promise<A>;
  readonly encodePure: <A>(request: SuiPureEncodeRequest<A>, options?: { readonly signal?: AbortSignal }) => Promise<Uint8Array>;
  readonly serialize: <A>(value: A, codec: unknown, options?: { readonly signal?: AbortSignal }) => Promise<Uint8Array>;
  readonly dispose: () => Promise<void>;
}
