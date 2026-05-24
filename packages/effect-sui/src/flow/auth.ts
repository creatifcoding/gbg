/** Authorization, transaction building, and signing services for SuiFlow. */

import { Transaction } from '@mysten/sui/transactions';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';

import type { SuiPtbBuildArtifact, SuiTx } from '../effectable';
import {
  decodeSuiAddress,
  KeypairAuthPolicy,
  OfflineAuthPolicy,
  SponsoredAuthPolicy,
  SuiExecutionError,
  SuiInvariantViolation,
  type SuiAddress,
  type SuiAuthPolicy,
} from '../schema';
import {
  SuiAuthService,
  type SuiAuthResult,
  type SuiAuthServiceShape,
  SuiClientService,
  type SuiGasPlan,
  type SuiPaymentPlan,
} from '../services';
import { execution, invariant } from './errors';
import type { ClientWithTransactionBuild, SignerLike } from './types';

export const makeAuthService = (client: ClientWithTransactionBuild): SuiAuthServiceShape => ({
  authorize: (tx, payment, artifact, gasPlan) => authorizeWithPolicy({ client, tx, payment, artifact, gasPlan }),
});

export const SuiAuthServiceFromClient = Layer.effect(SuiAuthService)(
  SuiClientService.useSync((service) => makeAuthService(service.client as ClientWithTransactionBuild)),
);

function authorizeWithPolicy(options: {
  readonly client: ClientWithTransactionBuild;
  readonly tx: SuiTx<unknown, unknown, unknown>;
  readonly payment: SuiPaymentPlan;
  readonly artifact?: SuiPtbBuildArtifact<unknown>;
  readonly gasPlan?: SuiGasPlan;
}): Effect.Effect<SuiAuthResult, SuiExecutionError | SuiInvariantViolation> {
  return Effect.gen(function* () {
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
        ? yield* Effect.map(asSigner(authPolicy.sponsorSigner), (sponsorSigner) =>
            signTransaction(sponsorSigner, transactionBytes),
          ).pipe(Effect.flatten)
        : undefined;
      return {
        signatures: sponsorSignature ? [senderSignature, sponsorSignature] : [senderSignature],
        transactionBytes,
      };
    }

    return yield* Effect.fail(invariant('SuiAuthService.policy', `Unsupported auth policy ${(authPolicy as SuiAuthPolicy)._tag}`));
  });
}

function getAuthPolicy(tx: SuiTx<unknown, unknown, unknown>): Effect.Effect<SuiAuthPolicy, SuiInvariantViolation> {
  return tx.authPolicy
    ? Effect.succeed(tx.authPolicy)
    : Effect.fail(invariant('SuiAuthService.authPolicy', `SuiTx ${tx.label} has no auth policy`));
}

function getTransaction(
  artifact: SuiPtbBuildArtifact<unknown> | undefined,
): Effect.Effect<Transaction, SuiInvariantViolation> {
  return artifact?.transaction instanceof Transaction
    ? Effect.succeed(artifact.transaction)
    : Effect.fail(invariant('SuiAuthService.artifact', 'SuiAuthService requires a SuiPtbBuildArtifact containing a Mysten Transaction'));
}

function applyGasAndPayment(
  transaction: Transaction,
  tx: SuiTx<unknown, unknown, unknown>,
  payment: SuiPaymentPlan,
  gasPlan: SuiGasPlan | undefined,
): Effect.Effect<void, SuiInvariantViolation> {
  return Effect.try({
    try: () => {
      if (tx.sender) transaction.setSenderIfNotSet(tx.sender);
      if (gasPlan?.price !== undefined) transaction.setGasPrice(gasPlan.price);
      if (gasPlan?.budget !== undefined) transaction.setGasBudget(gasPlan.budget);
      if (payment.gasOwner) transaction.setGasOwner(payment.gasOwner);
      if (payment.gasPayment.length > 0) {
        transaction.setGasPayment(payment.gasPayment.map((ref) => ref.toMysten()));
      }
    },
    catch: (cause) => invariant('SuiAuthService.applyGasAndPayment', cause),
  });
}

function asSigner(value: unknown): Effect.Effect<SignerLike, SuiInvariantViolation> {
  const signer = value as SignerLike;
  return signer && typeof signer.signTransaction === 'function'
    ? Effect.succeed(signer)
    : Effect.fail(invariant('SuiAuthService.signer', 'Auth policy signer does not expose signTransaction(bytes)'));
}

function signerAddress(signer: SignerLike): Effect.Effect<SuiAddress, SuiInvariantViolation> {
  return Effect.try({
    try: () => decodeSuiAddress(signer.toSuiAddress?.() ?? signer.getPublicKey?.().toSuiAddress()),
    catch: (cause) => invariant('SuiAuthService.signerAddress', cause),
  });
}

function buildTransaction(
  transaction: Transaction,
  client: ClientWithTransactionBuild,
): Effect.Effect<Uint8Array, SuiExecutionError> {
  return Effect.tryPromise({
    try: () => transaction.build({ client: client as never }),
    catch: (cause) => execution('SuiAuthService.buildTransaction', cause),
  });
}

function signTransaction(signer: SignerLike, transactionBytes: Uint8Array): Effect.Effect<string, SuiExecutionError> {
  return Effect.tryPromise({
    try: () => signer.signTransaction(transactionBytes).then((result) => result.signature),
    catch: (cause) => execution('SuiAuthService.signTransaction', cause),
  });
}
