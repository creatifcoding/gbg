/** Wallet callback bridge helpers for adapter-owned transaction edges. */

import * as Exit from 'effect-v4/Exit';

import { SuiTx } from '../effectable';
import { WalletCallbackAuthPolicy, type SuiAddress, type SuiWalletSignTransaction } from '../schema';
import type * as SuiFlow from '../flow';
import type { SuiTxLifecycleResult } from '../services';
import type { EffectSuiRunOptions, EffectSuiWalletRunHandle, EffectSuiWalletRunOptions } from './types';

export const makeWalletAuthPolicy = (options: EffectSuiWalletRunOptions): WalletCallbackAuthPolicy => new WalletCallbackAuthPolicy({
  sender: options.sender,
  chain: options.chain,
  account: options.account,
  signTransaction: options.signTransaction,
  supportedIntents: options.supportedIntents,
  context: options.context,
});

export const withWalletAuth = <A, E, R>(
  tx: SuiTx<A, E, R>,
  options: EffectSuiWalletRunOptions,
): SuiTx<A, E, R> => new SuiTx({
  ...tx.options,
  sender: options.sender,
  authPolicy: makeWalletAuthPolicy(options),
});

export const runWalletTxWithFlow = (
  flow: Pick<SuiFlow.SuiFlowClient, 'runExit'>,
  tx: SuiTx<unknown, unknown, unknown>,
  wallet: EffectSuiWalletRunOptions,
  options: EffectSuiRunOptions = {},
): EffectSuiWalletRunHandle => {
  const controller = new AbortController();
  const linkedSignal = mergeAbortSignals(controller, options.signal);
  const walletTx = withWalletAuth(tx, wallet);
  const exit = flow.runExit(walletTx, { ...options, signal: linkedSignal.signal }).finally(linkedSignal.cleanup);
  const promise = exit.then((outcome) => {
    if (Exit.isSuccess(outcome)) return outcome.value;
    throw outcome.cause;
  });
  const cancel = (reason?: unknown) => {
    if (!controller.signal.aborted) controller.abort(reason);
  };

  return {
    tx: walletTx,
    signal: linkedSignal.signal,
    promise,
    exit,
    cancel,
    dispose: cancel,
  };
};

interface LinkedAbortSignal {
  readonly signal: AbortSignal;
  readonly cleanup: () => void;
}

function mergeAbortSignals(controller: AbortController, external?: AbortSignal): LinkedAbortSignal {
  if (!external) return { signal: controller.signal, cleanup: () => undefined };
  if (external.aborted) {
    controller.abort(external.reason);
    return { signal: controller.signal, cleanup: () => undefined };
  }

  const abort = () => controller.abort(external.reason);
  external.addEventListener('abort', abort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => external.removeEventListener('abort', abort),
  };
}

export type { SuiAddress, SuiWalletSignTransaction };
