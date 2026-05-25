/** Transaction finality RPC service. */

import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import type { SuiExecutionError, SuiInvariantViolation } from '../schema';
import { SuiClientService, SuiFinalityService, type SuiFinalityRequest, type SuiFinalityResult, type SuiFinalityServiceShape } from '../services';
import { execution, invariant } from './errors';
import { transactionPayload } from './rpc-shared';
import type { ClientWithTransactionLifecycle } from './types';

export const makeFinalityService = (client: ClientWithTransactionLifecycle): SuiFinalityServiceShape => ({
  wait: (request) => waitForTransaction(client, request),
});

export const SuiFinalityServiceFromClient = Layer.effect(SuiFinalityService)(
  SuiClientService.useSync((service) => makeFinalityService(service.client as ClientWithTransactionLifecycle)),
);

const waitForTransaction = (
  client: ClientWithTransactionLifecycle,
  request: SuiFinalityRequest,
): Effect.Effect<SuiFinalityResult, SuiExecutionError | SuiInvariantViolation> => {
  if (!client.core.waitForTransaction) {
    return Effect.fail(invariant('SuiFinalityService.client', 'Client does not expose core.waitForTransaction'));
  }

  return Effect.gen(function* () {
    const raw = yield* Effect.tryPromise({
      try: () => client.core.waitForTransaction!({
        digest: request.execution.digest,
        include: { effects: true, transaction: true, events: true, balanceChanges: true },
        timeout: 60_000,
      }),
      catch: (cause) => execution('SuiFinalityService.waitForTransaction', cause),
    });
    const transaction = transactionPayload(raw);
    return { digest: request.execution.digest, transaction: raw, effects: transaction?.effects, events: transaction?.events ?? [] } satisfies SuiFinalityResult;
  });
};
