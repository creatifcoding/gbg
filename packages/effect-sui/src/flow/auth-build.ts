/** Transaction artifact, gas/payment application, and byte-build helpers for Sui auth. */

import { Transaction } from '@mysten/sui/transactions';
import * as Effect from 'effect-v4/Effect';

import type { SuiPtbBuildArtifact, SuiTx } from '../effectable';
import { SuiInvariantViolation } from '../schema';
import type { SuiGasPlan, SuiPaymentPlan } from '../services';
import { execution, invariant, type SuiExecutionFailure } from './errors';
import type { ClientWithTransactionBuild } from './types';

export const getTransaction = (
  artifact: SuiPtbBuildArtifact<unknown> | undefined,
): Effect.Effect<Transaction, SuiInvariantViolation> =>
  artifact?.transaction instanceof Transaction
    ? Effect.succeed(artifact.transaction)
    : Effect.fail(invariant('SuiAuthService.artifact', 'SuiAuthService requires a SuiPtbBuildArtifact containing a Mysten Transaction'));

export const applyGasAndPayment = (
  transaction: Transaction,
  tx: SuiTx<unknown, unknown, unknown>,
  payment: SuiPaymentPlan,
  gasPlan: SuiGasPlan | undefined,
): Effect.Effect<void, SuiInvariantViolation> => Effect.try({
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

export const buildTransaction = (
  transaction: Transaction,
  client: ClientWithTransactionBuild,
): Effect.Effect<Uint8Array, SuiExecutionFailure> => Effect.tryPromise({
  try: () => transaction.build({ client: client as never }),
  catch: (cause) => execution('SuiAuthService.buildTransaction', cause),
});
