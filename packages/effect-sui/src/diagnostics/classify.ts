import * as Cause from 'effect/Cause';
import * as Exit from 'effect/Exit';

import {
  SuiArgumentInvalidError,
  SuiAuthError,
  SuiBcsParseError,
  SuiBuildError,
  SuiDiagnostic,
  type SuiDiagnosticCategory,
  type SuiDiagnosticReasonKind,
  type SuiDiagnosticSeverity,
  SuiDryRunError,
  SuiExecutionError,
  SuiGasCoinConflictError,
  SuiGasPlanningError,
  SuiIndexerVisibilityError,
  SuiInsufficientGasError,
  SuiInvariantViolation,
  SuiMoveAbortError,
  SuiObjectLoadError,
  SuiObjectStaleError,
  SuiPackageError,
  SuiPaymentError,
  SuiProtocolLimitExceededError,
  SuiPtbCompileError,
  SuiPtbInvalidError,
  SuiPureEncodeError,
  SuiRejectedByValidatorError,
  SuiReservationConflict,
  SuiSchemaDecodeError,
  SuiSignatureError,
  SuiSponsorRejectedError,
  SuiTransportError,
  SuiTypeNotRegisteredError,
  SuiModuleNotFoundError,
  SuiWaitError,
  SuiWalletRejectedError,
  type SuiRetryHint,
} from '../schema';

type DiagnosticParts = {
  readonly category: SuiDiagnosticCategory;
  readonly severity: SuiDiagnosticSeverity;
  readonly retryHint: SuiRetryHint;
};

const unknownParts: DiagnosticParts = { category: 'unknown', severity: 'error', retryHint: 'never' };

export function classifyUnknown(cause: unknown): SuiDiagnostic {
  if (Cause.isCause(cause)) return classifyCause(cause);
  if (isExit(cause)) return classifyExit(cause) ?? successDiagnostic();
  return classifyError(cause, []);
}

export function classifyExit(exit: Exit.Exit<unknown, unknown>): SuiDiagnostic | undefined {
  return Exit.isFailure(exit) ? classifyCause(exit.cause) : undefined;
}

export function classifyCause(cause: Cause.Cause<unknown>): SuiDiagnostic {
  const reasonKinds = collectReasonKinds(cause);
  if (Cause.hasInterruptsOnly(cause)) {
    return diagnostic({ category: 'interrupt', severity: 'info', retryHint: 'notApplicable' }, 'Effect interrupted', undefined, reasonKinds);
  }

  const fail = cause.reasons.find(Cause.isFailReason);
  if (fail) return classifyError(fail.error, reasonKinds);

  const die = cause.reasons.find(Cause.isDieReason);
  if (die) return diagnostic({ category: 'defect', severity: 'fatal', retryHint: 'never' }, messageOf(die.defect), sourceTagOf(die.defect), reasonKinds);

  return diagnostic(unknownParts, Cause.pretty(cause), undefined, reasonKinds);
}

export function classifyError(error: unknown, reasonKinds: ReadonlyArray<SuiDiagnosticReasonKind> = []): SuiDiagnostic {
  const parts = classifyParts(error);
  return diagnostic(parts, messageOf(error), sourceTagOf(error), reasonKinds);
}

function classifyParts(error: unknown): DiagnosticParts {
  if (error instanceof SuiSchemaDecodeError) return { category: 'schema', severity: 'error', retryHint: 'never' };
  if (error instanceof SuiObjectStaleError) return { category: 'object', severity: 'warn', retryHint: 'refreshObjects' };
  if (error instanceof SuiObjectLoadError) return objectParts(error);
  if (error instanceof SuiTransportError) return { category: 'transport', severity: 'error', retryHint: 'checkNetwork' };
  if (error instanceof SuiBcsParseError || error instanceof SuiPureEncodeError) return { category: 'bcs', severity: 'error', retryHint: 'never' };
  if (
    error instanceof SuiPtbInvalidError ||
    error instanceof SuiArgumentInvalidError ||
    error instanceof SuiProtocolLimitExceededError ||
    error instanceof SuiPtbCompileError ||
    error instanceof SuiBuildError
  ) return { category: 'ptb', severity: 'error', retryHint: 'never' };
  if (error instanceof SuiGasPlanningError) return { category: 'gas', severity: 'error', retryHint: 'increaseGas' };
  if (error instanceof SuiDryRunError) return { category: 'preflight', severity: 'error', retryHint: 'never' };
  if (error instanceof SuiMoveAbortError) return { category: 'moveAbort', severity: 'error', retryHint: 'never' };
  if (error instanceof SuiPaymentError || error instanceof SuiGasCoinConflictError) return { category: 'payment', severity: 'warn', retryHint: 'waitAndRetry' };
  if (error instanceof SuiInsufficientGasError) return { category: 'payment', severity: 'error', retryHint: 'increaseGas' };
  if (error instanceof SuiSponsorRejectedError) return { category: 'payment', severity: 'error', retryHint: 'reauthorize' };
  if (error instanceof SuiAuthError || error instanceof SuiSignatureError || error instanceof SuiWalletRejectedError) return { category: 'auth', severity: 'error', retryHint: 'reauthorize' };
  if (error instanceof SuiRejectedByValidatorError) return validatorParts(error);
  if (error instanceof SuiExecutionError) return { category: 'execution', severity: 'error', retryHint: 'retry' };
  if (error instanceof SuiWaitError) return waitParts(error);
  if (error instanceof SuiIndexerVisibilityError) return { category: 'finality', severity: 'warn', retryHint: 'waitAndRetry' };
  if (error instanceof SuiPackageError || error instanceof SuiModuleNotFoundError || error instanceof SuiTypeNotRegisteredError) return { category: 'package', severity: 'error', retryHint: 'never' };
  if (error instanceof SuiReservationConflict) return { category: 'reservation', severity: 'warn', retryHint: 'waitAndRetry' };
  if (error instanceof SuiInvariantViolation) return { category: 'invariant', severity: 'fatal', retryHint: 'never' };
  return unknownParts;
}

function objectParts(error: SuiObjectLoadError): DiagnosticParts {
  if (error.code === 'stale') return { category: 'object', severity: 'warn', retryHint: 'refreshObjects' };
  if (error.code === 'unknown' || error.code === 'displayError') return { category: 'object', severity: 'error', retryHint: 'retry' };
  return { category: 'object', severity: 'error', retryHint: 'never' };
}

function validatorParts(error: SuiRejectedByValidatorError): DiagnosticParts {
  return error.kind === 'CongestedObjects'
    ? { category: 'execution', severity: 'warn', retryHint: 'waitAndRetry' }
    : { category: 'execution', severity: 'error', retryHint: 'never' };
}

function waitParts(error: SuiWaitError): DiagnosticParts {
  if (error.kind === 'aborted') return { category: 'finality', severity: 'info', retryHint: 'notApplicable' };
  if (error.kind === 'timeout' || error.kind === 'notVisible') return { category: 'finality', severity: 'warn', retryHint: 'waitAndRetry' };
  if (error.kind === 'transport') return { category: 'transport', severity: 'error', retryHint: 'checkNetwork' };
  return { category: 'finality', severity: 'warn', retryHint: 'retry' };
}

function diagnostic(
  parts: DiagnosticParts,
  message: string,
  sourceTag: string | undefined,
  reasonKinds: ReadonlyArray<SuiDiagnosticReasonKind>,
): SuiDiagnostic {
  return new SuiDiagnostic({
    ...parts,
    message,
    sourceTag,
    reasonKinds: reasonKinds.length === 0 ? ['unknown'] : [...reasonKinds],
  });
}

function successDiagnostic(): SuiDiagnostic {
  return new SuiDiagnostic({
    category: 'unknown',
    severity: 'debug',
    retryHint: 'notApplicable',
    message: 'Effect succeeded',
    reasonKinds: ['unknown'],
  });
}

function collectReasonKinds(cause: Cause.Cause<unknown>): ReadonlyArray<SuiDiagnosticReasonKind> {
  const kinds = new Set<SuiDiagnosticReasonKind>();
  for (const reason of cause.reasons) {
    if (Cause.isFailReason(reason)) kinds.add('fail');
    else if (Cause.isDieReason(reason)) kinds.add('die');
    else if (Cause.isInterruptReason(reason)) kinds.add('interrupt');
    else kinds.add('unknown');
  }
  return [...kinds];
}

function sourceTagOf(value: unknown): string | undefined {
  if (value !== null && typeof value === 'object') {
    const tag = (value as { readonly _tag?: unknown })._tag;
    if (typeof tag === 'string') return tag;
    const name = (value as { readonly name?: unknown }).name;
    if (typeof name === 'string') return name;
  }
  return undefined;
}

function messageOf(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (value !== null && typeof value === 'object') {
    const message = (value as { readonly message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(value);
}

function isExit(value: unknown): value is Exit.Exit<unknown, unknown> {
  return value !== null && typeof value === 'object' && '_tag' in value && ((value as { readonly _tag?: unknown })._tag === 'Success' || (value as { readonly _tag?: unknown })._tag === 'Failure');
}
