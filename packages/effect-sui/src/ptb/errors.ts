/** Typed PTB invariant constructors. */

import { SuiInvariantViolation } from '../schema';

export function ptbInvariant(phase: 'analyze' | 'compile', message: string, cause?: unknown): SuiInvariantViolation {
  return new SuiInvariantViolation({
    invariant: `SuiPTB.${phase}`,
    message,
    cause,
  });
}

export function normalizePtbError(phase: string, cause: unknown): SuiInvariantViolation {
  if (cause instanceof SuiInvariantViolation) return cause;
  return new SuiInvariantViolation({
    invariant: `SuiPTB.${phase}`,
    message: cause instanceof Error ? cause.message : String(cause),
    cause,
  });
}
