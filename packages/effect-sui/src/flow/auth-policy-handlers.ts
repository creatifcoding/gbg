import { fromBase64 } from '@mysten/bcs';
import type { Transaction } from '@mysten/sui/transactions';
import * as Effect from 'effect/Effect';

import { KeypairAuthPolicy, OfflineAuthPolicy, SponsoredAuthPolicy, WalletCallbackAuthPolicy, type SuiAuthPolicy, type SuiWalletSignResult, type SuiWalletSignTransaction } from '../schema';
import type { SuiAuthResult } from '../services';
import { buildTransaction } from './auth-build';
import { asSigner, signerAddress, signTransaction } from './auth-signing';
import { auth, signature, type SuiFlowError } from './errors';
import type { ClientWithTransactionBuild } from './types';

export const authorizeTransactionWithPolicy = (
  authPolicy: SuiAuthPolicy,
  transaction: Transaction,
  client: ClientWithTransactionBuild,
): Effect.Effect<SuiAuthResult, SuiFlowError> => Effect.gen(function* () {
  if (authPolicy instanceof OfflineAuthPolicy) return yield* authorizeOffline(authPolicy, transaction, client);
  if (authPolicy instanceof KeypairAuthPolicy) return yield* authorizeKeypair(authPolicy, transaction, client);
  if (authPolicy instanceof SponsoredAuthPolicy) return yield* authorizeSponsored(authPolicy, transaction, client);
  if (authPolicy instanceof WalletCallbackAuthPolicy) return yield* authorizeWalletCallback(authPolicy, transaction, client);
  return yield* Effect.fail(auth('unknown', 'Unsupported auth policy'));
});

const authorizeOffline = (policy: OfflineAuthPolicy, transaction: Transaction, client: ClientWithTransactionBuild) => Effect.gen(function* () {
  transaction.setSenderIfNotSet(policy.sender);
  const transactionBytes = yield* buildTransaction(transaction, client);
  return { signatures: [], transactionBytes, offlinePayload: { sender: policy.sender, transactionBytes } };
});

const authorizeKeypair = (policy: KeypairAuthPolicy, transaction: Transaction, client: ClientWithTransactionBuild) => Effect.gen(function* () {
  const signer = yield* asSigner(policy.signer);
  transaction.setSenderIfNotSet(policy.sender ?? (yield* signerAddress(signer)));
  const transactionBytes = yield* buildTransaction(transaction, client);
  return { signatures: [yield* signTransaction(signer, transactionBytes)], transactionBytes };
});

const authorizeSponsored = (policy: SponsoredAuthPolicy, transaction: Transaction, client: ClientWithTransactionBuild) => Effect.gen(function* () {
  const signer = yield* asSigner(policy.signer);
  transaction.setSenderIfNotSet(policy.sender);
  transaction.setGasOwner(policy.sponsor);
  const transactionBytes = yield* buildTransaction(transaction, client);
  const senderSignature = yield* signTransaction(signer, transactionBytes);
  const sponsorSignature = policy.sponsorSigner ? yield* signTransaction(yield* asSigner(policy.sponsorSigner), transactionBytes) : undefined;
  return { signatures: sponsorSignature ? [senderSignature, sponsorSignature] : [senderSignature], transactionBytes };
});

const authorizeWalletCallback = (policy: WalletCallbackAuthPolicy, transaction: Transaction, client: ClientWithTransactionBuild) => Effect.gen(function* () {
  const signTransaction = yield* asWalletSignTransaction(policy.signTransaction);
  transaction.setSenderIfNotSet(policy.sender);
  const transactionBytes = yield* buildTransaction(transaction, client);
  const transactionWrapper = {
    toJSON: () => transaction.toJSON({ client: client as never, supportedIntents: policy.supportedIntents as never }),
  };
  const signed = yield* Effect.tryPromise({
    try: (signal) => signTransaction({
      sender: policy.sender,
      chain: policy.chain,
      account: policy.account,
      transaction: transactionWrapper,
      transactionBytes,
      signal,
      context: policy.context,
    }),
    catch: (cause) => signature('wallet', cause),
  });
  return {
    signatures: [signed.signature],
    transactionBytes: decodeWalletTransactionBytes(signed, transactionBytes),
    walletPayload: signed.walletPayload ?? signed,
  };
});

const asWalletSignTransaction = (value: unknown): Effect.Effect<SuiWalletSignTransaction, ReturnType<typeof auth>> =>
  typeof value === 'function'
    ? Effect.succeed(value as SuiWalletSignTransaction)
    : Effect.fail(auth('wallet', 'Wallet auth policy does not expose signTransaction(request)'));

const decodeWalletTransactionBytes = (signed: SuiWalletSignResult, fallback: Uint8Array): Uint8Array => {
  if (!signed.bytes) return fallback;
  return typeof signed.bytes === 'string' ? fromBase64(signed.bytes) : signed.bytes;
};
