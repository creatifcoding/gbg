/** Sui transaction RPC services for preflight, execution, and finality. */

import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';

import { decodeSuiTransactionDigest, SuiExecutionError, SuiInvariantViolation } from '../schema';
import {
  type SuiAuthResult,
  SuiClientService,
  SuiExecutionService,
  type SuiExecutionRequest,
  type SuiExecutionResultEnvelope,
  type SuiExecutionServiceShape,
  SuiFinalityService,
  type SuiFinalityRequest,
  type SuiFinalityResult,
  type SuiFinalityServiceShape,
  SuiPreflightService,
  type SuiPreflightRequest,
  type SuiPreflightResult,
  type SuiPreflightServiceShape,
} from '../services';
import { execution, invariant } from './errors';
import type { ClientWithTransactionLifecycle } from './types';

export const makePreflightService = (client: ClientWithTransactionLifecycle): SuiPreflightServiceShape => ({
  dryRun: (request) => dryRunTransaction(client, request),
});

export const SuiPreflightServiceFromClient = Layer.effect(SuiPreflightService)(
  SuiClientService.useSync((service) => makePreflightService(service.client as ClientWithTransactionLifecycle)),
);

export const makeExecutionService = (client: ClientWithTransactionLifecycle): SuiExecutionServiceShape => ({
  execute: (request) => executeTransaction(client, request),
});

export const SuiExecutionServiceFromClient = Layer.effect(SuiExecutionService)(
  SuiClientService.useSync((service) => makeExecutionService(service.client as ClientWithTransactionLifecycle)),
);

export const makeFinalityService = (client: ClientWithTransactionLifecycle): SuiFinalityServiceShape => ({
  wait: (request) => waitForTransaction(client, request),
});

export const SuiFinalityServiceFromClient = Layer.effect(SuiFinalityService)(
  SuiClientService.useSync((service) => makeFinalityService(service.client as ClientWithTransactionLifecycle)),
);

function dryRunTransaction(
  client: ClientWithTransactionLifecycle,
  request: SuiPreflightRequest,
): Effect.Effect<SuiPreflightResult, SuiExecutionError | SuiInvariantViolation> {
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
      catch: (cause) => execution('SuiPreflightService.simulateTransaction', cause),
    });
    const transaction = transactionPayload(raw);
    const status = transactionStatus(raw);
    return {
      status: status.success ? 'success' : 'failure',
      gasUsed: transaction?.effects?.gasUsed,
      diagnostics: status.diagnostics,
      raw,
    } satisfies SuiPreflightResult;
  });
}

function executeTransaction(
  client: ClientWithTransactionLifecycle,
  request: SuiExecutionRequest,
): Effect.Effect<SuiExecutionResultEnvelope, SuiExecutionError | SuiInvariantViolation> {
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
}

function waitForTransaction(
  client: ClientWithTransactionLifecycle,
  request: SuiFinalityRequest,
): Effect.Effect<SuiFinalityResult, SuiExecutionError | SuiInvariantViolation> {
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
    return {
      digest: request.execution.digest,
      transaction: raw,
      effects: transaction?.effects,
      events: transaction?.events ?? [],
    } satisfies SuiFinalityResult;
  });
}

function requireTransactionBytes(auth: SuiAuthResult, invariantName: string): Effect.Effect<Uint8Array, SuiInvariantViolation> {
  return auth.transactionBytes
    ? Effect.succeed(auth.transactionBytes)
    : Effect.fail(invariant(invariantName, 'Auth result does not include transaction bytes'));
}

function digestFromTransactionResult(result: unknown, command: string): Effect.Effect<ReturnType<typeof decodeSuiTransactionDigest>, SuiExecutionError> {
  const digest = transactionPayload(result)?.digest;
  return digest
    ? Effect.try({
        try: () => decodeSuiTransactionDigest(digest),
        catch: (cause) => execution(command, cause),
      })
    : Effect.fail(execution(command, 'Transaction result did not include a digest'));
}

type TransactionPayloadLike = {
  readonly digest?: string;
  readonly status?: { readonly success?: boolean; readonly error?: unknown };
  readonly effects?: { readonly gasUsed?: unknown; readonly status?: { readonly success?: boolean; readonly error?: unknown } };
  readonly events?: ReadonlyArray<unknown>;
};

function transactionPayload(result: unknown): TransactionPayloadLike | undefined {
  const envelope = result as {
    readonly Transaction?: TransactionPayloadLike;
    readonly FailedTransaction?: TransactionPayloadLike;
    readonly digest?: string;
    readonly effects?: TransactionPayloadLike['effects'];
    readonly events?: ReadonlyArray<unknown>;
  };
  return envelope.Transaction ?? envelope.FailedTransaction ?? (
    envelope.digest ? { digest: envelope.digest, effects: envelope.effects, events: envelope.events } : undefined
  );
}

function transactionStatus(result: unknown): { readonly success: boolean; readonly diagnostics: ReadonlyArray<string> } {
  const envelope = result as { readonly $kind?: string };
  const transaction = transactionPayload(result);
  const status = transaction?.status ?? transaction?.effects?.status;
  const failedByKind = envelope.$kind === 'FailedTransaction';
  const success = failedByKind ? false : status?.success !== false;
  const diagnostics = success ? [] : [String(status?.error ?? 'transaction simulation failed')];
  return { success, diagnostics };
}
