/** Preflight dry-run RPC service. */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { SuiClientService, SuiPreflightService, type SuiPreflightRequest, type SuiPreflightResult, type SuiPreflightServiceShape } from '../services';
import { dryRun, invariant, type SuiFlowError } from './errors';
import { requireTransactionBytes, transactionPayload, transactionStatus } from './rpc-shared';
import type { ClientWithTransactionLifecycle } from './types';

export const makePreflightService = (client: ClientWithTransactionLifecycle): SuiPreflightServiceShape => ({
  dryRun: (request) => dryRunTransaction(client, request),
});

export const SuiPreflightServiceFromClient = Layer.effect(SuiPreflightService)(
  SuiClientService.useSync((service) => makePreflightService(service.client as ClientWithTransactionLifecycle)),
);

const dryRunTransaction = (
  client: ClientWithTransactionLifecycle,
  request: SuiPreflightRequest,
): Effect.Effect<SuiPreflightResult, SuiFlowError> => {
  if (!client.core.simulateTransaction) {
    return Effect.fail(invariant('SuiPreflightService.client', 'Client does not expose core.simulateTransaction'));
  }

  return Effect.gen(function* () {
    const transactionBytes = yield* requireTransactionBytes(request.auth, 'SuiPreflightService.transactionBytes');
    const raw = yield* Effect.tryPromise({
      try: () => client.core.simulateTransaction!({
        transaction: transactionBytes,
        include: { effects: true, transaction: true, events: true, balanceChanges: true },
      }),
      catch: (cause) => dryRun('SuiPreflightService.simulateTransaction', cause),
    });
    const transaction = transactionPayload(raw);
    const status = transactionStatus(raw);
    return { status: status.success ? 'success' : 'failure', gasUsed: transaction?.effects?.gasUsed, diagnostics: status.diagnostics, raw } satisfies SuiPreflightResult;
  });
};
