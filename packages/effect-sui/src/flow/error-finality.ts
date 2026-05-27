import {
  SuiIndexerVisibilityError,
  SuiWaitError,
  type SuiTransactionDigest,
  type SuiWaitErrorKind,
} from '../schema';
import { asRecord, messageOf } from './error-shared';
import { execution, extractExecutionError, type SuiExecutionFailure } from './error-execution';

export type SuiFinalityFailure = SuiWaitError | SuiIndexerVisibilityError;

export function wait(
  digest: SuiTransactionDigest | undefined,
  timeoutMs: number | undefined,
  cause: unknown,
): SuiWaitError | SuiExecutionFailure {
  if (cause instanceof SuiWaitError) return cause;
  if (extractExecutionError(cause)) return execution('SuiFinalityService.waitForTransaction', cause);

  return new SuiWaitError({
    kind: waitKind(cause),
    digest,
    timeoutMs,
    message: messageOf(cause),
    cause,
  });
}

export function indexerVisibility(digest: SuiTransactionDigest, cause: unknown): SuiIndexerVisibilityError {
  if (cause instanceof SuiIndexerVisibilityError) return cause;
  return new SuiIndexerVisibilityError({ digest, message: messageOf(cause), cause });
}

function waitKind(cause: unknown): SuiWaitErrorKind {
  const record = asRecord(cause);
  const name = typeof record?.name === 'string' ? record.name.toLowerCase() : '';
  const message = messageOf(cause).toLowerCase();
  if (name.includes('abort') || message.includes('abort')) return 'aborted';
  if (message.includes('timeout') || message.includes('timed out')) return 'timeout';
  if (message.includes('not visible') || message.includes('not found')) return 'notVisible';
  if (message.includes('network') || message.includes('fetch') || message.includes('transport')) return 'transport';
  return 'unknown';
}
