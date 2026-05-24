/** Typed SuiFlow error constructors. */

import { SuiExecutionError, SuiInvariantViolation } from '../schema';

export function invariant(invariantName: string, cause: unknown): SuiInvariantViolation {
  if (cause instanceof SuiInvariantViolation) return cause;
  return new SuiInvariantViolation({
    invariant: invariantName,
    message: cause instanceof Error ? cause.message : String(cause),
    cause,
  });
}

export function execution(command: string, cause: unknown): SuiExecutionError {
  if (cause instanceof SuiExecutionError) return cause;
  return new SuiExecutionError({
    command,
    message: cause instanceof Error ? cause.message : String(cause),
    cause,
  });
}
