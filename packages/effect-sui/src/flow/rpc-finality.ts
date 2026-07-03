/** Transaction finality RPC service. */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import {
  SuiClientService,
  SuiFinalityService,
  type SuiFinalityIncludeOptions,
  type SuiFinalityRequest,
  type SuiFinalityResult,
  type SuiFinalityServiceShape,
  type SuiFinalityWatchRequest,
} from '../services';
import { invariant, wait, type SuiFlowError } from './errors';
import { transactionPayload } from './rpc-shared';
import type { ClientWithTransactionLifecycle } from './types';

const defaultFinalityInclude = {
  effects: true,
  transaction: true,
  events: true,
  balanceChanges: true,
  objectTypes: true,
} satisfies SuiFinalityIncludeOptions;

export const makeFinalityService = (client: ClientWithTransactionLifecycle): SuiFinalityServiceShape => ({
  wait: (request) => waitForTransaction(client, { ...request, digest: request.execution.digest }),
  waitForDigest: (request) => waitForTransaction(client, request),
});

export const SuiFinalityServiceFromClient = Layer.effect(SuiFinalityService)(
  SuiClientService.useSync((service) => makeFinalityService(service.client as ClientWithTransactionLifecycle)),
);

const waitForTransaction = (
  client: ClientWithTransactionLifecycle,
  request: SuiFinalityWatchRequest,
): Effect.Effect<SuiFinalityResult, SuiFlowError> => {
  if (!client.core.waitForTransaction) {
    return Effect.fail(invariant('SuiFinalityService.client', 'Client does not expose core.waitForTransaction'));
  }

  return Effect.gen(function* () {
    const raw = yield* Effect.tryPromise({
      try: (signal) => client.core.waitForTransaction!({
        digest: request.digest,
        include: request.include ?? defaultFinalityInclude,
        timeout: request.timeoutMs ?? 60_000,
        signal,
        ...(request.pollSchedule ? { pollSchedule: [...request.pollSchedule] } : {}),
      }),
      catch: (cause) => wait(request.digest, request.timeoutMs ?? 60_000, cause),
    });
    const transaction = transactionPayload(raw);
    return {
      digest: request.digest,
      transaction: raw,
      effects: transaction?.effects,
      events: transaction?.events ?? [],
      objectTypes: transaction?.objectTypes,
    } satisfies SuiFinalityResult;
  }).pipe(
    Effect.withSpan('@tmnl/effect-sui/SuiFinalityService.waitForTransaction', {
      attributes: { digest: request.digest, timeoutMs: request.timeoutMs ?? 60_000 },
    }),
  );
};
