import type * as Exit from 'effect-v4/Exit';
import type * as Layer from 'effect-v4/Layer';

import type { SuiTx } from '../effectable';
import type * as SuiFlow from '../flow';
import type * as SuiQuery from '../query';
import type { SuiAddress, SuiObjectId, SuiWalletSignTransaction } from '../schema';
import type { SuiObjectResolveRequest, SuiObjectResolveResult, SuiTxLifecycleResult } from '../services';

export type EffectSuiClientSource = SuiFlow.ClientWithTransactionLifecycle & SuiQuery.ClientWithCoreReads;
export type EffectSuiRunOptions = { readonly signal?: AbortSignal };

export interface EffectSuiWalletRunOptions {
  readonly sender: SuiAddress;
  readonly chain: string;
  readonly account: unknown;
  readonly signTransaction: SuiWalletSignTransaction;
  readonly supportedIntents?: ReadonlyArray<string>;
  readonly context?: unknown;
}

export interface EffectSuiWalletRunHandle {
  readonly tx: SuiTx<unknown, unknown, unknown>;
  readonly signal: AbortSignal;
  readonly promise: Promise<SuiTxLifecycleResult>;
  readonly exit: Promise<Exit.Exit<SuiTxLifecycleResult, unknown>>;
  readonly cancel: (reason?: unknown) => void;
  readonly dispose: (reason?: unknown) => void;
}

export interface EffectSuiAdapterClient {
  readonly flow: SuiFlow.SuiFlowClient;
  readonly query: SuiQuery.SuiQueryClient;
  readonly runTx: (tx: SuiTx<unknown, unknown, unknown>, options?: EffectSuiRunOptions) => Promise<SuiTxLifecycleResult>;
  readonly runTxExit: (tx: SuiTx<unknown, unknown, unknown>, options?: EffectSuiRunOptions) => Promise<Exit.Exit<SuiTxLifecycleResult, unknown>>;
  readonly runWalletTx: (tx: SuiTx<unknown, unknown, unknown>, wallet: EffectSuiWalletRunOptions, options?: EffectSuiRunOptions) => EffectSuiWalletRunHandle;
  readonly resolveObject: <A>(request: SuiObjectResolveRequest<A> | SuiObjectId, options?: EffectSuiRunOptions) => Promise<SuiObjectResolveResult<A>>;
  readonly dispose: () => Promise<void>;
}

export interface EffectSuiRuntimeCache {
  readonly getOrCreate: (client: EffectSuiClientSource, factory: () => EffectSuiAdapterClient) => EffectSuiAdapterClient;
  readonly dispose: (client: EffectSuiClientSource) => Promise<void>;
}

export interface EffectSuiAdapterOptions<Name extends string = 'effectSui'> {
  readonly name?: Name;
  readonly cache?: EffectSuiRuntimeCache;
  readonly memoMap?: Layer.MemoMap;
}

export interface EffectSuiExtension<Name extends string = 'effectSui'> {
  readonly name: Name;
  readonly register: (client: EffectSuiClientSource) => EffectSuiAdapterClient;
}
