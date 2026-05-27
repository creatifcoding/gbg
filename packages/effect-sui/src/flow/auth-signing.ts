/** Signer normalization and transaction signing helpers for Sui auth. */

import * as Effect from 'effect-v4/Effect';

import { decodeSuiAddress, type SuiAddress } from '../schema';
import { auth, signature } from './errors';
import type { SignerLike } from './types';

export const asSigner = (value: unknown): Effect.Effect<SignerLike, ReturnType<typeof auth>> => {
  const signer = value as SignerLike;
  return signer && typeof signer.signTransaction === 'function'
    ? Effect.succeed(signer)
    : Effect.fail(auth('unknown', 'Auth policy signer does not expose signTransaction(bytes)'));
};

export const signerAddress = (signer: SignerLike): Effect.Effect<SuiAddress, ReturnType<typeof auth>> => Effect.try({
  try: () => decodeSuiAddress(signer.toSuiAddress?.() ?? signer.getPublicKey?.().toSuiAddress()),
  catch: (cause) => auth('unknown', cause),
});

export const signTransaction = (
  signer: SignerLike,
  transactionBytes: Uint8Array,
): Effect.Effect<string, ReturnType<typeof signature>> => Effect.tryPromise({
  try: () => signer.signTransaction(transactionBytes).then((result) => result.signature),
  catch: (cause) => signature('keypair', cause),
});
