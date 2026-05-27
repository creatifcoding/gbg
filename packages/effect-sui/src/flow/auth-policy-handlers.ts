import type { Transaction } from '@mysten/sui/transactions';
import * as Effect from 'effect-v4/Effect';

import { KeypairAuthPolicy, OfflineAuthPolicy, SponsoredAuthPolicy, type SuiAuthPolicy } from '../schema';
import type { SuiAuthResult } from '../services';
import { buildTransaction } from './auth-build';
import { asSigner, signerAddress, signTransaction } from './auth-signing';
import { auth, type SuiFlowError } from './errors';
import type { ClientWithTransactionBuild } from './types';

export const authorizeTransactionWithPolicy = (
  authPolicy: SuiAuthPolicy,
  transaction: Transaction,
  client: ClientWithTransactionBuild,
): Effect.Effect<SuiAuthResult, SuiFlowError> => Effect.gen(function* () {
  if (authPolicy instanceof OfflineAuthPolicy) return yield* authorizeOffline(authPolicy, transaction, client);
  if (authPolicy instanceof KeypairAuthPolicy) return yield* authorizeKeypair(authPolicy, transaction, client);
  if (authPolicy instanceof SponsoredAuthPolicy) return yield* authorizeSponsored(authPolicy, transaction, client);
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
