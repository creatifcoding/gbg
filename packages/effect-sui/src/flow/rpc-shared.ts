/** Shared transaction RPC normalization helpers. */

import * as Effect from 'effect-v4/Effect';
import { decodeSuiTransactionDigest, type SuiExecutionError, type SuiInvariantViolation } from '../schema';
import type { SuiAuthResult } from '../services';
import { execution, invariant } from './errors';

export type TransactionPayloadLike = {
  readonly digest?: string;
  readonly status?: { readonly success?: boolean; readonly error?: unknown };
  readonly effects?: { readonly gasUsed?: unknown; readonly status?: { readonly success?: boolean; readonly error?: unknown } };
  readonly events?: ReadonlyArray<unknown>;
};

export const requireTransactionBytes = (
  auth: SuiAuthResult,
  invariantName: string,
): Effect.Effect<Uint8Array, SuiInvariantViolation> => auth.transactionBytes
  ? Effect.succeed(auth.transactionBytes)
  : Effect.fail(invariant(invariantName, 'Auth result does not include transaction bytes'));

export const digestFromTransactionResult = (
  result: unknown,
  command: string,
): Effect.Effect<ReturnType<typeof decodeSuiTransactionDigest>, SuiExecutionError> => {
  const digest = transactionPayload(result)?.digest;
  return digest
    ? Effect.try({ try: () => decodeSuiTransactionDigest(digest), catch: (cause) => execution(command, cause) })
    : Effect.fail(execution(command, 'Transaction result did not include a digest'));
};

export const transactionPayload = (result: unknown): TransactionPayloadLike | undefined => {
  const envelope = result as {
    readonly Transaction?: TransactionPayloadLike;
    readonly FailedTransaction?: TransactionPayloadLike;
    readonly digest?: string;
    readonly effects?: TransactionPayloadLike['effects'];
    readonly events?: ReadonlyArray<unknown>;
  };
  return envelope.Transaction ?? envelope.FailedTransaction ?? (envelope.digest
    ? { digest: envelope.digest, effects: envelope.effects, events: envelope.events }
    : undefined);
};

export const transactionStatus = (result: unknown): { readonly success: boolean; readonly diagnostics: ReadonlyArray<string> } => {
  const envelope = result as { readonly $kind?: string };
  const transaction = transactionPayload(result);
  const status = transaction?.status ?? transaction?.effects?.status;
  const success = envelope.$kind === 'FailedTransaction' ? false : status?.success !== false;
  return { success, diagnostics: success ? [] : [String(status?.error ?? 'transaction simulation failed')] };
};
