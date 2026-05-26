/** Signer normalization and transaction signing helpers for Sui auth. */

import * as Effect from 'effect-v4/Effect';

import { decodeSuiAddress, SuiExecutionError, SuiInvariantViolation, type SuiAddress } from '../schema';
import { execution, invariant } from './errors';
import type { SignerLike } from './types';

export const asSigner = (value: unknown): Effect.Effect<SignerLike, SuiInvariantViolation> => {
  const signer = value as SignerLike;
  return signer && typeof signer.signTransaction === 'function'
    ? Effect.succeed(signer)
    : Effect.fail(invariant('SuiAuthService.signer', 'Auth policy signer does not expose signTransaction(bytes)'));
};

export const signerAddress = (signer: SignerLike): Effect.Effect<SuiAddress, SuiInvariantViolation> => Effect.try({
  try: () => decodeSuiAddress(signer.toSuiAddress?.() ?? signer.getPublicKey?.().toSuiAddress()),
  catch: (cause) => invariant('SuiAuthService.signerAddress', cause),
});

export const signTransaction = (
  signer: SignerLike,
  transactionBytes: Uint8Array,
): Effect.Effect<string, SuiExecutionError> => Effect.tryPromise({
  try: () => signer.signTransaction(transactionBytes).then((result) => result.signature),
  catch: (cause) => execution('SuiAuthService.signTransaction', cause),
});
