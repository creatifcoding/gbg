/** Auth policy dispatch for Sui transaction authorization. */

import * as Effect from 'effect-v4/Effect';

import type { SuiPtbBuildArtifact, SuiTx } from '../effectable';
import { type SuiAuthPolicy } from '../schema';
import type { SuiAuthResult, SuiGasPlan, SuiPaymentPlan } from '../services';
import { applyGasAndPayment, getTransaction } from './auth-build';
import { authorizeTransactionWithPolicy } from './auth-policy-handlers';
import { auth, type SuiFlowError } from './errors';
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
): Effect.Effect<SuiAuthResult, SuiFlowError> => Effect.gen(function* () {
  const authPolicy = yield* getAuthPolicy(options.tx);
  const transaction = yield* getTransaction(options.artifact);
  yield* applyGasAndPayment(transaction, options.tx, options.payment, options.gasPlan);
  return yield* authorizeTransactionWithPolicy(authPolicy, transaction, options.client);
});

export const getAuthPolicy = (
  tx: SuiTx<unknown, unknown, unknown>,
): Effect.Effect<SuiAuthPolicy, ReturnType<typeof auth>> => tx.authPolicy
  ? Effect.succeed(tx.authPolicy)
  : Effect.fail(auth('unknown', `SuiTx ${tx.label} has no auth policy`));
