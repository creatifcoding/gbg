/** Auth policy dispatch for Sui transaction authorization. */

import * as Effect from 'effect-v4/Effect';

import type { SuiPtbBuildArtifact, SuiTx } from '../effectable';
import {
  KeypairAuthPolicy,
  OfflineAuthPolicy,
  SponsoredAuthPolicy,
  SuiExecutionError,
  SuiInvariantViolation,
  type SuiAuthPolicy,
} from '../schema';
import type { SuiAuthResult, SuiGasPlan, SuiPaymentPlan } from '../services';
import { applyGasAndPayment, buildTransaction, getTransaction } from './auth-build';
import { asSigner, signerAddress, signTransaction } from './auth-signing';
import { invariant } from './errors';
import type { ClientWithTransactionBuild } from './types';

export interface AuthorizeWithPolicyOptions {
  readonly client: ClientWithTransactionBuild;
  readonly tx: SuiTx<unknown, unknown, unknown>;
  readonly payment: SuiPaymentPlan;
  readonly artifact?: SuiPtbBuildArtifact<unknown>;
  readonly gasPlan?: SuiGasPlan;
}

export const authorizeWithPolicy = (
  options: AuthorizeWithPolicyOptions,
): Effect.Effect<SuiAuthResult, SuiExecutionError | SuiInvariantViolation> => Effect.gen(function* () {
  const authPolicy = yield* getAuthPolicy(options.tx);
  const transaction = yield* getTransaction(options.artifact);
  yield* applyGasAndPayment(transaction, options.tx, options.payment, options.gasPlan);

  if (authPolicy instanceof OfflineAuthPolicy) {
    transaction.setSenderIfNotSet(authPolicy.sender);
    const transactionBytes = yield* buildTransaction(transaction, options.client);
    return {
      signatures: [],
      transactionBytes,
      offlinePayload: { sender: authPolicy.sender, transactionBytes },
    };
  }

  if (authPolicy instanceof KeypairAuthPolicy) {
    const signer = yield* asSigner(authPolicy.signer);
    const sender = authPolicy.sender ?? (yield* signerAddress(signer));
    transaction.setSenderIfNotSet(sender);
    const transactionBytes = yield* buildTransaction(transaction, options.client);
    const signature = yield* signTransaction(signer, transactionBytes);
    return { signatures: [signature], transactionBytes };
  }

  if (authPolicy instanceof SponsoredAuthPolicy) {
    const signer = yield* asSigner(authPolicy.signer);
    transaction.setSenderIfNotSet(authPolicy.sender);
    transaction.setGasOwner(authPolicy.sponsor);
    const transactionBytes = yield* buildTransaction(transaction, options.client);
    const senderSignature = yield* signTransaction(signer, transactionBytes);
    const sponsorSignature = authPolicy.sponsorSigner
      ? yield* signTransaction(yield* asSigner(authPolicy.sponsorSigner), transactionBytes)
      : undefined;
    return {
      signatures: sponsorSignature ? [senderSignature, sponsorSignature] : [senderSignature],
      transactionBytes,
    };
  }

  return yield* Effect.fail(invariant('SuiAuthService.policy', `Unsupported auth policy ${(authPolicy as SuiAuthPolicy)._tag}`));
});

export const getAuthPolicy = (
  tx: SuiTx<unknown, unknown, unknown>,
): Effect.Effect<SuiAuthPolicy, SuiInvariantViolation> => tx.authPolicy
  ? Effect.succeed(tx.authPolicy)
  : Effect.fail(invariant('SuiAuthService.authPolicy', `SuiTx ${tx.label} has no auth policy`));
