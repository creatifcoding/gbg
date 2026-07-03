/** Transaction execution RPC service. */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { SuiClientService, SuiExecutionService, type SuiExecutionRequest, type SuiExecutionResultEnvelope, type SuiExecutionServiceShape } from '../services';
import { execution, invariant, type SuiFlowError } from './errors';
import { digestFromTransactionResult, requireTransactionBytes } from './rpc-shared';
import type { ClientWithTransactionLifecycle } from './types';

export const makeExecutionService = (client: ClientWithTransactionLifecycle): SuiExecutionServiceShape => ({
  execute: (request) => executeTransaction(client, request),
});

export const SuiExecutionServiceFromClient = Layer.effect(SuiExecutionService)(
  SuiClientService.useSync((service) => makeExecutionService(service.client as ClientWithTransactionLifecycle)),
);

const executeTransaction = (
  client: ClientWithTransactionLifecycle,
  request: SuiExecutionRequest,
): Effect.Effect<SuiExecutionResultEnvelope, SuiFlowError> => {
  if (!client.core.executeTransaction) {
    return Effect.fail(invariant('SuiExecutionService.client', 'Client does not expose core.executeTransaction'));
  }

  return Effect.gen(function* () {
    const transactionBytes = yield* requireTransactionBytes(request.auth, 'SuiExecutionService.transactionBytes');
    if (request.auth.signatures.length === 0) {
      return yield* Effect.fail(invariant('SuiExecutionService.signatures', 'Execution requires at least one signature'));
    }
    const raw = yield* Effect.tryPromise({
      try: () => client.core.executeTransaction!({
        transaction: transactionBytes,
        signatures: [...request.auth.signatures],
        include: { effects: true, transaction: true, events: true, balanceChanges: true },
      }),
      catch: (cause) => execution('SuiExecutionService.executeTransaction', cause),
    });
    const digest = yield* digestFromTransactionResult(raw, 'SuiExecutionService.executeTransaction');
    return { digest, raw } satisfies SuiExecutionResultEnvelope;
  });
};
